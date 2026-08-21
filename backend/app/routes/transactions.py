from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Escrow, Milestone, Transaction
from ..models.transaction import ACTIONS
from ..utils.errors import api_error
from ..utils.serializers import to_iso, utcnow
from ..utils.validators import is_valid_address, is_valid_tx_hash, is_valid_wei, normalize_address

bp = Blueprint('transactions', __name__)

# 涉及 milestone 状态变化的动作(data-model.md 2.3 action 枚举)
MILESTONE_ACTIONS = ('SUBMIT_MILESTONE', 'APPROVE_MILESTONE', 'RAISE_DISPUTE', 'RESOLVE_DISPUTE', 'REFUND')
TX_STATUSES = ('CONFIRMED', 'FAILED')


@bp.get('/transactions')
def list_transactions():
    """GET /api/transactions —— 交易历史(时间倒序 + 过滤 + 分页),见 docs/api-spec.md 3.1

    对 spec 的两处小扩展:action 支持逗号分隔多值(如 action=A,B);
    每项附带 escrow_title(表格展示项目名用,无关联项目时为 null)。
    """
    escrow_id = request.args.get('escrow_id', type=int)
    address = request.args.get('address')
    action = request.args.get('action')
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)

    if address and not is_valid_address(address):
        return api_error('INVALID_ADDRESS', 'address must be 0x + 40 hex chars', 400)
    if action:
        action_list = action.split(',')
        if any(a not in ACTIONS for a in action_list):
            return api_error('VALIDATION_ERROR', f'action must be one of: {"/".join(ACTIONS)}', 400)
    if status and status not in TX_STATUSES:
        return api_error('VALIDATION_ERROR', f'status must be one of: {"/".join(TX_STATUSES)}', 400)
    if page < 1:
        return api_error('VALIDATION_ERROR', 'page must be >= 1', 400)
    page_size = max(1, min(page_size, 50))

    query = Transaction.query
    if escrow_id is not None:
        query = query.filter(Transaction.escrow_id == escrow_id)
    if address:
        query = query.filter(Transaction.from_address == normalize_address(address))
    if action:
        if len(action.split(',')) == 1:
            query = query.filter(Transaction.action == action)
        else:
            query = query.filter(Transaction.action.in_(action.split(',')))
    if status:
        query = query.filter(Transaction.status == status)

    total = query.count()
    items = (
        query.order_by(Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # 一次查出关联项目的标题,避免 N+1
    escrow_ids = [t.escrow_id for t in items if t.escrow_id is not None]
    titles = {}
    if escrow_ids:
        titles = {
            e.escrow_id: e.title
            for e in Escrow.query.filter(Escrow.escrow_id.in_(escrow_ids)).all()
        }

    def _serialize(t):
        return {
            'tx_hash': t.tx_hash,
            'escrow_id': t.escrow_id,
            'escrow_title': titles.get(t.escrow_id),
            'milestone_index': t.milestone_index,
            'action': t.action,
            'from_address': t.from_address,
            'amount_wei': t.amount_wei,
            'status': t.status,
            'block_number': t.block_number,
            'created_at': to_iso(t.created_at),
            'confirmed_at': to_iso(t.confirmed_at),
        }

    return jsonify({
        'total': total,
        'page': page,
        'page_size': page_size,
        'items': [_serialize(t) for t in items],
    })


@bp.post('/transactions')
def create_transaction():
    """POST /api/transactions —— 链上交易确认后一次性上报,见 docs/api-spec.md 3.2

    如果 action 涉及 milestone 状态变化,写入记录的同时自动更新对应
    milestone / escrow 的状态(SQLite 只是链上真相的镜像,状态推导规则
    与合约 FreelanceEscrow.sol 保持一致)。
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error('VALIDATION_ERROR', 'request body must be a JSON object', 400)

    required = ('tx_hash', 'action', 'from_address', 'status')
    missing = [f for f in required if data.get(f) in (None, '')]
    if missing:
        return api_error('VALIDATION_ERROR', f'missing required fields: {", ".join(missing)}', 400)

    tx_hash = data['tx_hash']
    action = data['action']
    from_address = data['from_address']
    status = data['status']

    if not is_valid_tx_hash(tx_hash):
        return api_error('VALIDATION_ERROR', 'tx_hash must be a 66-character tx hash', 400)
    if action not in ACTIONS:
        return api_error('VALIDATION_ERROR', f'action must be one of: {"/".join(ACTIONS)}', 400)
    if status not in TX_STATUSES:
        return api_error('VALIDATION_ERROR', f'status must be one of: {"/".join(TX_STATUSES)}', 400)
    if not is_valid_address(from_address):
        return api_error('INVALID_ADDRESS', 'from_address must be 0x + 40 hex chars', 400)
    if Transaction.query.filter_by(tx_hash=tx_hash).first():
        return api_error('DUPLICATE_TX_HASH', f'tx_hash={tx_hash} already reported', 409)

    amount_wei = data.get('amount_wei')
    if amount_wei is not None and not is_valid_wei(amount_wei):
        return api_error('VALIDATION_ERROR', 'amount_wei must be a numeric string', 400)
    block_number = data.get('block_number')
    if block_number is not None and not isinstance(block_number, int):
        return api_error('VALIDATION_ERROR', 'block_number must be an integer', 400)

    escrow_id = data.get('escrow_id')
    milestone_index = data.get('milestone_index')

    escrow = None
    milestone = None
    if action == 'FUND_ESCROW' or action in MILESTONE_ACTIONS:
        if not isinstance(escrow_id, int):
            return api_error('VALIDATION_ERROR', f'{action} requires escrow_id', 400)
        escrow = Escrow.query.filter_by(escrow_id=escrow_id).first()
        if not escrow:
            return api_error('ESCROW_NOT_FOUND', f'escrow_id={escrow_id} does not exist', 404)
        if action in MILESTONE_ACTIONS:
            if not isinstance(milestone_index, int):
                return api_error('VALIDATION_ERROR', f'{action} requires milestone_index', 400)
            milestone = Milestone.query.filter_by(escrow_id=escrow_id, milestone_index=milestone_index).first()
            if not milestone:
                return api_error('MILESTONE_NOT_FOUND', f'escrow_id={escrow_id} milestone_index={milestone_index} does not exist', 404)

    # 状态推导:仅 CONFIRMED 的交易会改变业务状态,FAILED 只留记录(api-spec 3.2)
    if status == 'CONFIRMED':
        if action == 'FUND_ESCROW':
            escrow.status = 'FUNDED'
        elif action == 'SUBMIT_MILESTONE':
            milestone.status = 'SUBMITTED'
            milestone.submitted_at = utcnow()
        elif action == 'APPROVE_MILESTONE':
            milestone.status = 'RELEASED'
            milestone.approved_at = utcnow()
            if _all_milestones_terminal(escrow):
                escrow.status = 'COMPLETED'
        elif action == 'RAISE_DISPUTE':
            milestone.status = 'DISPUTED'
        elif action == 'RESOLVE_DISPUTE':
            # 裁决方向不在 api-spec 原字段里,这里加可选字段 resolve_to_freelancer(扩展说明见函数注释)
            resolve_to_freelancer = data.get('resolve_to_freelancer')
            if not isinstance(resolve_to_freelancer, bool):
                return api_error('VALIDATION_ERROR', 'RESOLVE_DISPUTE requires resolve_to_freelancer (bool)', 400)
            milestone.approved_at = utcnow()
            if resolve_to_freelancer:
                milestone.status = 'RELEASED'
                if _all_milestones_terminal(escrow):
                    escrow.status = 'COMPLETED'
            else:
                milestone.status = 'REFUNDED'
                if _all_milestones_terminal(escrow):
                    escrow.status = 'CANCELLED'
        elif action == 'REFUND':
            milestone.status = 'REFUNDED'
            milestone.approved_at = utcnow()
            if _all_milestones_terminal(escrow):
                escrow.status = 'CANCELLED'
        # CREATE_ESCROW 的状态由 POST /api/escrows 建立,这里只记交易

    tx = Transaction(
        tx_hash=tx_hash,
        escrow_id=escrow_id,
        milestone_index=milestone_index,
        action=action,
        from_address=normalize_address(from_address),
        amount_wei=amount_wei,
        status=status,
        block_number=block_number,
        confirmed_at=utcnow() if status == 'CONFIRMED' else None,
    )
    db.session.add(tx)
    db.session.commit()

    return jsonify({
        'tx_hash': tx.tx_hash,
        'status': tx.status,
        'block_number': tx.block_number,
        'created_at': to_iso(tx.created_at),
    }), 201


def _all_milestones_terminal(escrow):
    """所有 milestone 都处于终态(RELEASED / REFUNDED)——与合约 _allMilestonesTerminal 一致"""
    return all(m.status in ('RELEASED', 'REFUNDED') for m in escrow.milestones)

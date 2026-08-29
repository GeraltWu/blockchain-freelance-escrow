from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Escrow, Milestone
from ..utils.errors import api_error
from ..utils.serializers import to_iso
from ..utils.validators import is_valid_address, is_valid_tx_hash, is_valid_wei, normalize_address, parse_iso

bp = Blueprint('escrows', __name__)

ESCROW_STATUSES = ('CREATED', 'FUNDED', 'COMPLETED', 'CANCELLED')
ROLES = ('client', 'freelancer', 'arbitrator')


def _serialize_escrow(escrow, include_milestones=False):
    """Escrow → dict。列表用精简字段(见 docs/api-spec.md 1.1),详情附带 milestones(1.2)"""
    data = {
        'escrow_id': escrow.escrow_id,
        'client_address': escrow.client_address,
        'freelancer_address': escrow.freelancer_address,
        'arbitrator_address': escrow.arbitrator_address,
        'title': escrow.title,
        'total_amount_wei': escrow.total_amount_wei,
        'status': escrow.status,
        'deadline': to_iso(escrow.deadline),
        'created_at': to_iso(escrow.created_at),
    }
    if include_milestones:
        data.update({
            'description': escrow.description,
            'tx_hash_create': escrow.tx_hash_create,
            'updated_at': to_iso(escrow.updated_at),
            'milestones': [
                {
                    'milestone_index': m.milestone_index,
                    'description': m.description,
                    'amount_wei': m.amount_wei,
                    'status': m.status,
                    'submitted_at': to_iso(m.submitted_at),
                    'approved_at': to_iso(m.approved_at),
                }
                for m in escrow.milestones
            ],
        })
    return data


@bp.get('/escrows')
def list_escrows():
    """GET /api/escrows —— 项目列表(地址/角色/状态过滤 + 分页),见 docs/api-spec.md 1.1"""
    address = request.args.get('address')
    role = request.args.get('role')
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 10, type=int)

    if address and not is_valid_address(address):
        return api_error('INVALID_ADDRESS', 'address must be 0x + 40 hex chars', 400)
    if role and role not in ROLES:
        return api_error('VALIDATION_ERROR', f'role must be one of: {"/".join(ROLES)}', 400)
    if status and status not in ESCROW_STATUSES:
        return api_error('VALIDATION_ERROR', f'status must be one of: {"/".join(ESCROW_STATUSES)}', 400)
    if page < 1:
        return api_error('VALIDATION_ERROR', 'page must be >= 1', 400)
    page_size = max(1, min(page_size, 50))  # 上限 50,见 api-spec

    query = Escrow.query
    if address:
        normalized = normalize_address(address)  # 库里统一小写,查询同样小写化
        if role == 'client':
            query = query.filter(Escrow.client_address == normalized)
        elif role == 'freelancer':
            query = query.filter(Escrow.freelancer_address == normalized)
        elif role == 'arbitrator':
            query = query.filter(Escrow.arbitrator_address == normalized)
        else:
            # 不传 role 时三种身份都匹配:仲裁者也能在 Dashboard 看到自己被指定的项目
            query = query.filter(db.or_(
                Escrow.client_address == normalized,
                Escrow.freelancer_address == normalized,
                Escrow.arbitrator_address == normalized,
            ))
    if status:
        query = query.filter(Escrow.status == status)

    total = query.count()
    items = (
        query.order_by(Escrow.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify({
        'total': total,
        'page': page,
        'page_size': page_size,
        'items': [_serialize_escrow(e) for e in items],
    })


@bp.get('/escrows/<int:escrow_id>')
def get_escrow(escrow_id):
    """GET /api/escrows/<escrow_id> —— 项目详情(顺带返回 milestones),见 docs/api-spec.md 1.2"""
    escrow = Escrow.query.filter_by(escrow_id=escrow_id).first()
    if not escrow:
        return api_error('ESCROW_NOT_FOUND', f'escrow_id={escrow_id} does not exist', 404)
    return jsonify(_serialize_escrow(escrow, include_milestones=True))


@bp.post('/escrows')
def create_escrow():
    """POST /api/escrows —— 链上 createEscrow 交易确认后保存项目元数据,见 docs/api-spec.md 1.3

    后端只做字段层面的二次校验(初步设计.md 十七:双层验证),
    资金/权限的最终判断永远在链上。
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error('VALIDATION_ERROR', 'request body must be a JSON object', 400)

    required = ('escrow_id', 'client_address', 'freelancer_address', 'arbitrator_address', 'title',
                'total_amount_wei', 'deadline', 'tx_hash_create', 'milestones')
    missing = [f for f in required if data.get(f) in (None, '')]
    if missing:
        return api_error('VALIDATION_ERROR', f'missing required fields: {", ".join(missing)}', 400)

    escrow_id = data['escrow_id']
    if not isinstance(escrow_id, int) or escrow_id < 0:
        return api_error('VALIDATION_ERROR', 'escrow_id must be a non-negative integer', 400)
    if Escrow.query.filter_by(escrow_id=escrow_id).first():
        return api_error('ESCROW_ALREADY_EXISTS', f'escrow_id={escrow_id} already exists', 409)

    for key in ('client_address', 'freelancer_address', 'arbitrator_address'):
        if not is_valid_address(data[key]):
            return api_error('INVALID_ADDRESS', f'{key} must be 0x + 40 hex chars', 400)
    if data['client_address'].lower() == data['freelancer_address'].lower():
        return api_error('VALIDATION_ERROR', 'client_address and freelancer_address must differ', 400)
    if data['arbitrator_address'].lower() in (data['client_address'].lower(), data['freelancer_address'].lower()):
        return api_error(
            'VALIDATION_ERROR',
            'arbitrator_address must differ from client_address and freelancer_address',
            400,
        )

    title = str(data['title']).strip()
    if not title or len(title) > 120:
        return api_error('VALIDATION_ERROR', 'title must be 1-120 characters', 400)

    if not is_valid_wei(data['total_amount_wei']):
        return api_error('VALIDATION_ERROR', 'total_amount_wei must be a numeric string', 400)

    deadline = parse_iso(data['deadline'])
    if deadline is None:
        return api_error('VALIDATION_ERROR', 'deadline must be an ISO 8601 datetime string', 400)

    if not is_valid_tx_hash(data['tx_hash_create']):
        return api_error('VALIDATION_ERROR', 'tx_hash_create must be a 66-character tx hash', 400)

    raw_milestones = data['milestones']
    if not isinstance(raw_milestones, list) or not raw_milestones:
        return api_error('VALIDATION_ERROR', 'milestones must be a non-empty array', 400)

    milestones, total = [], 0
    for index, m in enumerate(raw_milestones):
        if not isinstance(m, dict):
            return api_error('VALIDATION_ERROR', 'each milestone must be an object', 400)
        if m.get('milestone_index') != index:
            return api_error(
                'VALIDATION_ERROR',
                f'milestones must be sequential from 0 (position {index} has index {m.get("milestone_index")})',
                400,
            )
        description = str(m.get('description', '')).strip()
        if not description or len(description) > 200:
            return api_error('VALIDATION_ERROR', 'milestone description must be 1-200 characters', 400)
        if not is_valid_wei(m.get('amount_wei')):
            return api_error('VALIDATION_ERROR', 'milestone amount_wei must be a numeric string', 400)
        total += int(m['amount_wei'])
        milestones.append((index, description, m['amount_wei']))

    if total != int(data['total_amount_wei']):
        return api_error(
            'MILESTONE_AMOUNT_MISMATCH',
            'sum of milestone amounts must equal total_amount_wei',
            400,
        )

    escrow = Escrow(
        escrow_id=escrow_id,
        client_address=normalize_address(data['client_address']),
        freelancer_address=normalize_address(data['freelancer_address']),
        arbitrator_address=normalize_address(data['arbitrator_address']),
        title=title,
        description=str(data.get('description') or '').strip() or None,
        total_amount_wei=data['total_amount_wei'],
        status='CREATED',
        deadline=deadline,
        tx_hash_create=data['tx_hash_create'],
    )
    for index, description, amount in milestones:
        escrow.milestones.append(Milestone(
            milestone_index=index,
            description=description,
            amount_wei=amount,
        ))
    db.session.add(escrow)
    db.session.commit()

    return jsonify({
        'escrow_id': escrow.escrow_id,
        'status': escrow.status,
        'created_at': to_iso(escrow.created_at),
    }), 201

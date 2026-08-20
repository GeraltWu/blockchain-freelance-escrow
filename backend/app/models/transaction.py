from ..extensions import db
from ..utils.serializers import utcnow

# 链上交易动作枚举(见 docs/data-model.md 2.3)
ACTIONS = (
    'CREATE_ESCROW', 'FUND_ESCROW', 'SUBMIT_MILESTONE', 'APPROVE_MILESTONE',
    'RAISE_DISPUTE', 'RESOLVE_DISPUTE', 'REFUND',
)


# 链下 transactions 表(交易索引),见 docs/data-model.md 2.3
# 本表当前只有模型,路由在「Transaction History」功能迭代时实现
class Transaction(db.Model):
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    escrow_id = db.Column(db.Integer, db.ForeignKey('escrows.escrow_id'), nullable=True)
    milestone_index = db.Column(db.Integer, nullable=True)
    tx_hash = db.Column(db.String(66), unique=True, nullable=False)
    action = db.Column(db.String(30), nullable=False)
    from_address = db.Column(db.String(42), nullable=False)
    amount_wei = db.Column(db.String(78))
    status = db.Column(db.String(20), nullable=False, default='PENDING')  # PENDING/CONFIRMED/FAILED
    block_number = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    confirmed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Transaction {self.action} {self.status}>'

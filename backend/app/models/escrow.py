from ..extensions import db
from ..utils.serializers import utcnow


# 链下 escrows 表(链上数据的展示缓存 + 链上不存的元数据),见 docs/data-model.md 2.1
class Escrow(db.Model):
    __tablename__ = 'escrows'

    id = db.Column(db.Integer, primary_key=True)  # 数据库主键,不等于链上 id
    escrow_id = db.Column(db.Integer, unique=True, nullable=False, index=True)  # 链上 escrowId
    client_address = db.Column(db.String(42), nullable=False, index=True)
    freelancer_address = db.Column(db.String(42), nullable=False, index=True)
    title = db.Column(db.String(120))  # 链上不存,纯展示用
    description = db.Column(db.Text)
    total_amount_wei = db.Column(db.String(78), nullable=False)  # wei 字符串,避免精度问题
    status = db.Column(db.String(20), nullable=False, default='CREATED')  # CREATED/FUNDED/COMPLETED/CANCELLED
    deadline = db.Column(db.DateTime)
    tx_hash_create = db.Column(db.String(66))
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    milestones = db.relationship(
        'Milestone', back_populates='escrow_ref', lazy='select',
        order_by='Milestone.milestone_index',
    )

    def __repr__(self):
        return f'<Escrow #{self.escrow_id} {self.status}>'

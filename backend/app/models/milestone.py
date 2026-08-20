from ..extensions import db


# 链下 milestones 表,见 docs/data-model.md 2.2
class Milestone(db.Model):
    __tablename__ = 'milestones'
    __table_args__ = (
        db.UniqueConstraint('escrow_id', 'milestone_index', name='uq_escrow_milestone'),
    )

    id = db.Column(db.Integer, primary_key=True)
    escrow_id = db.Column(db.Integer, db.ForeignKey('escrows.escrow_id'), nullable=False, index=True)
    milestone_index = db.Column(db.Integer, nullable=False)  # 在该 escrow 内的序号,0 起(对应链上 M1=0)
    description = db.Column(db.String(200), nullable=False)
    amount_wei = db.Column(db.String(78), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='PENDING')  # PENDING/SUBMITTED/DISPUTED/RELEASED/REFUNDED
    submitted_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    tx_hash_submit = db.Column(db.String(66))
    tx_hash_approve = db.Column(db.String(66))

    escrow_ref = db.relationship('Escrow', back_populates='milestones')

    def __repr__(self):
        return f'<Milestone escrow={self.escrow_id} idx={self.milestone_index} {self.status}>'

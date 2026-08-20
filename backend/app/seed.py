"""示例数据:与前端 src/data/mock.js 保持一致,链上接入前的开发用数据。"""
from datetime import datetime

from .extensions import db
from .models import Escrow, Milestone

# 演示地址:前端 Dashboard 在真实钱包接入前用这个地址查询(见 Dashboard.jsx 的 DEMO_ADDRESS)
ME = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
A = '0x8Ba1f109551bD432803012645Ac136ddd64DBA72'
B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
C = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
D = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
E = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
F = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'


def _hash(seed):
    """造一个形态真实的假交易哈希"""
    return f'0x{seed:064x}'


# (escrow_id, client, freelancer, title, description, total_wei, status, deadline, 创建时间,
#  milestones: [(描述, wei, status, submitted_at, approved_at), ...])
SEED_DATA = [
    (12, ME, A, 'DeFi Analytics Dashboard',
     'A dashboard tracking DeFi positions and portfolio analytics.',
     '1000000000000000000', 'FUNDED', datetime(2026, 9, 30), datetime(2026, 8, 2, 10, 0),
     [('UI Design & Prototype', '400000000000000000', 'RELEASED', datetime(2026, 8, 6, 9), datetime(2026, 8, 7, 14)),
      ('Frontend Development', '300000000000000000', 'SUBMITTED', datetime(2026, 8, 18, 11), None),
      ('Integration & Launch', '300000000000000000', 'PENDING', None, None)]),
    (11, ME, B, 'NFT Collectibles Smart Contract',
     'ERC-721 collectible contract with minting and reveal mechanics.',
     '2000000000000000000', 'CREATED', datetime(2026, 10, 15), datetime(2026, 8, 10, 16, 30),
     [('Contract Development', '1000000000000000000', 'PENDING', None, None),
      ('Testnet Deployment & Audit', '1000000000000000000', 'PENDING', None, None)]),
    (9, ME, C, 'Personal Blog Full-Stack Development',
     'A responsive personal blog with a headless CMS.',
     '800000000000000000', 'COMPLETED', datetime(2026, 8, 1), datetime(2026, 7, 5, 9),
     [('Backend & CMS', '400000000000000000', 'RELEASED', datetime(2026, 7, 12, 10), datetime(2026, 7, 13, 15)),
      ('Frontend Pages', '400000000000000000', 'RELEASED', datetime(2026, 7, 26, 9), datetime(2026, 7, 28, 11))]),
    (8, ME, D, 'On-chain Voting Governance DApp',
     'A governance DApp with on-chain proposal voting.',
     '1500000000000000000', 'FUNDED', datetime(2026, 9, 10), datetime(2026, 8, 1, 12),
     [('Governance Contract & Voting Logic', '500000000000000000', 'DISPUTED', datetime(2026, 8, 15, 10), None),
      ('Frontend Voting UI', '500000000000000000', 'PENDING', None, None),
      ('Deployment', '500000000000000000', 'PENDING', None, None)]),
    (5, ME, E, 'DEX Trading Page Redesign',
     'A redesign of the trading page for a decentralized exchange.',
     '600000000000000000', 'CANCELLED', datetime(2026, 8, 15), datetime(2026, 6, 20, 14),
     [('Trading Pair List Page', '300000000000000000', 'REFUNDED', None, datetime(2026, 7, 18, 16)),
      ('Candlestick Component', '300000000000000000', 'REFUNDED', None, datetime(2026, 7, 18, 16))]),
    (13, F, ME, 'Oracle Data Feed Module',
     'A module pulling price feeds from a decentralized oracle.',
     '600000000000000000', 'FUNDED', datetime(2026, 9, 20), datetime(2026, 8, 8, 9),
     [('Price Feed Integration', '200000000000000000', 'RELEASED', datetime(2026, 8, 12, 15), datetime(2026, 8, 13, 10)),
      ('Aggregator Implementation', '400000000000000000', 'PENDING', None, None)]),
    (14, B, ME, 'DApp Website Migration to Vite',
     'Migrate the DApp landing site to Vite with a modern toolchain.',
     '1200000000000000000', 'FUNDED', datetime(2026, 8, 28), datetime(2026, 8, 5, 11),
     [('Migration & Responsive Design', '500000000000000000', 'SUBMITTED', datetime(2026, 8, 17, 16), None),
      ('SEO & Performance', '700000000000000000', 'PENDING', None, None)]),
    (15, C, ME, 'Wallet Connection & Transaction Flow SDK',
     'An SDK wrapping wallet connection and transaction flows.',
     '900000000000000000', 'FUNDED', datetime(2026, 10, 5), datetime(2026, 8, 14, 10),
     [('SDK Wrapper', '500000000000000000', 'PENDING', None, None),
      ('Example App', '400000000000000000', 'PENDING', None, None)]),
]


def seed_database():
    """向空库灌入示例 escrows + milestones(幂等:仅当库为空时调用)"""
    for escrow_id, client, freelancer, title, desc, total, status, deadline, created, milestones in SEED_DATA:
        escrow = Escrow(
            escrow_id=escrow_id,
            client_address=client,
            freelancer_address=freelancer,
            title=title,
            description=desc,
            total_amount_wei=total,
            status=status,
            deadline=deadline,
            tx_hash_create=_hash(escrow_id),
            created_at=created,
            updated_at=created,
        )
        for index, (m_desc, m_amount, m_status, submitted, approved) in enumerate(milestones):
            escrow.milestones.append(Milestone(
                milestone_index=index,
                description=m_desc,
                amount_wei=m_amount,
                status=m_status,
                submitted_at=submitted,
                approved_at=approved,
                tx_hash_submit=_hash(escrow_id * 10 + index) if submitted else None,
                tx_hash_approve=_hash(escrow_id * 10 + index + 1) if approved else None,
            ))
        db.session.add(escrow)
    db.session.commit()

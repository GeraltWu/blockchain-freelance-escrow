# 数据模型文档 — Freelance Milestone Escrow DApp

数据分两层：**链上（Solidity，资金真相）** 和 **链下（SQLite，展示用镜像 + 元数据）**。
两层通过 `escrow_id`（链上返回的整数 ID）关联。

---

## 一、链上数据模型（Solidity）

### 1.1 枚举

```solidity
enum EscrowStatus {
    CREATED,     // 0 已创建，尚未存入资金
    FUNDED,      // 1 客户已存入全部资金，项目进行中
    COMPLETED,   // 2 所有 milestone 都已 RELEASED，项目结束
    CANCELLED    // 3 已退款/取消
}

enum MilestoneStatus {
    PENDING,     // 0 尚未开始
    SUBMITTED,   // 1 Freelancer 已提交，等待 Client 审核
    DISPUTED,    // 2 有争议，等待 Arbitrator 处理
    RELEASED,    // 3 资金已释放给 Freelancer（终态）。approve 和 release 是同一笔交易，
                 //   所以没有单独的 APPROVED 状态，SUBMITTED 之后直接跳到 RELEASED
    REFUNDED     // 4 资金已退回给 Client（终态，一般发生在 dispute 判给 client 之后）
}
```

### 1.2 Struct：Escrow

```solidity
struct Escrow {
    uint256 id;              // 全局自增 ID，也是链下数据库里的 escrow_id
    address client;          // 客户钱包地址
    address freelancer;      // 自由职业者钱包地址
    uint256 totalAmount;     // 项目总金额，单位 wei（= 所有 milestone.amount 之和）
    uint256 fundedAmount;    // 客户已实际存入合约的金额，单位 wei
    uint256 deadline;        // 项目截止时间，unix timestamp（秒）
    EscrowStatus status;     // 当前项目状态
    uint256 milestoneCount;  // 该项目下 milestone 数量
    uint256 createdAt;       // 创建时间，unix timestamp
}
```

### 1.3 Struct：Milestone

```solidity
struct Milestone {
    uint256 index;            // 在该 escrow 内的序号，从 0 开始（M1 = index 0）
    string description;       // 阶段说明，例如 "UI Design"
    uint256 amount;           // 该阶段金额，单位 wei
    MilestoneStatus status;   // 当前状态
    uint256 submittedAt;      // Freelancer 提交时间，0 表示尚未提交
    uint256 approvedAt;       // Client 批准/资金释放时间，0 表示尚未批准
}
```

### 1.4 存储映射

```solidity
mapping(uint256 => Escrow) public escrows;                      // escrowId => Escrow
mapping(uint256 => Milestone[]) public escrowMilestones;        // escrowId => Milestone[]
mapping(address => uint256[]) public clientEscrows;              // client地址 => escrowId[]
mapping(address => uint256[]) public freelancerEscrows;          // freelancer地址 => escrowId[]
address public arbitrator;                                       // 唯一仲裁地址（Contract Owner 兼任）
uint256 public nextEscrowId;                                     // 自增计数器
```

### 1.5 关键事件（Event）— 链下监听/索引依赖这些

```solidity
event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed freelancer, uint256 totalAmount, uint256 deadline);
event EscrowFunded(uint256 indexed escrowId, uint256 amount);
event MilestoneSubmitted(uint256 indexed escrowId, uint256 indexed milestoneIndex);
event MilestoneApproved(uint256 indexed escrowId, uint256 indexed milestoneIndex, uint256 amountReleased);
event DisputeRaised(uint256 indexed escrowId, uint256 indexed milestoneIndex, address raisedBy);
event DisputeResolved(uint256 indexed escrowId, uint256 indexed milestoneIndex, bool releasedToFreelancer);
event Refunded(uint256 indexed escrowId, uint256 amount);
```

> 这些事件就是链下 `transactions` 表的数据来源——无论是靠 `chain_listener.py` 自动监听，还是前端在交易确认后手动 POST，本质都是把这些事件"翻译"成一行记录。

---

## 二、链下数据模型（SQLite / Flask-SQLAlchemy）

链下数据库**不是链上数据的替代**，而是：
1. 存链上不适合存的东西（标题、描述这类长文本）
2. 做一份可以快速查询/分页/过滤的缓存镜像，避免前端每次都要发 RPC 请求查链上

### 2.1 表：`escrows`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer, PK, autoincrement | 数据库自增主键（不等于链上 id） |
| escrow_id | Integer, unique, not null | **链上的 escrowId**，与合约里的 `Escrow.id` 一一对应 |
| client_address | String(42), not null, indexed | 客户钱包地址 |
| freelancer_address | String(42), not null, indexed | 自由职业者钱包地址 |
| title | String(120) | 项目标题（链上不存，纯展示用） |
| description | Text | 项目描述 |
| total_amount_wei | String(78) | 总金额（用字符串存，避免大整数精度问题） |
| status | String(20) | 缓存的链上状态，如 `CREATED` / `FUNDED` / `COMPLETED` / `CANCELLED` |
| deadline | DateTime | 截止时间 |
| tx_hash_create | String(66) | 创建交易的 hash |
| created_at | DateTime, default=now | 记录创建时间 |
| updated_at | DateTime, onupdate=now | 最后同步时间 |

```json
{
  "id": 1,                                   // 数据库主键，前端一般用不到
  "escrow_id": 1,                            // 链上 escrowId，前端调用合约要用这个
  "client_address": "0x123abc...",           // 40位十六进制 + 0x 前缀
  "freelancer_address": "0x456def...",
  "title": "个人作品集网站开发",                // 纯展示，不影响资金逻辑
  "description": "需要一个响应式的个人网站，包含首页/项目页/联系页",
  "total_amount_wei": "1000000000000000000", // 1 ETH，以 wei 为单位的字符串
  "status": "FUNDED",                        // CREATED | FUNDED | COMPLETED | CANCELLED
  "deadline": "2026-12-01T00:00:00Z",
  "tx_hash_create": "0xabc123...",
  "created_at": "2026-08-19T10:00:00Z",
  "updated_at": "2026-08-19T10:35:00Z"
}
```

### 2.2 表：`milestones`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer, PK | 数据库主键 |
| escrow_id | Integer, FK -> escrows.escrow_id | 所属项目（链上 escrowId） |
| milestone_index | Integer, not null | 在该 escrow 内的序号，对应链上 `Milestone.index` |
| description | String(200) | 阶段说明 |
| amount_wei | String(78) | 该阶段金额 |
| status | String(20) | PENDING / SUBMITTED / DISPUTED / RELEASED / REFUNDED |
| submitted_at | DateTime, nullable | 提交时间 |
| approved_at | DateTime, nullable | 放款时间（approve 和 release 是同一笔交易） |
| tx_hash_submit | String(66), nullable | 提交交易 hash |
| tx_hash_approve | String(66), nullable | 批准/放款交易 hash |

> `status` 不通过单独的更新接口维护，而是由后端在处理 `POST /api/transactions` 时，根据传入的 `action` 自动推导并写入（见接口文档模块三）。

联合唯一约束：`(escrow_id, milestone_index)` 唯一。

```json
{
  "id": 5,
  "escrow_id": 1,                  // 对应 escrows.escrow_id
  "milestone_index": 0,            // 即 M1，链上从 0 开始计数
  "description": "UI Design",
  "amount_wei": "200000000000000000",  // 0.2 ETH
  "status": "RELEASED",            // PENDING | SUBMITTED | DISPUTED | RELEASED | REFUNDED
  "submitted_at": "2026-08-19T11:20:00Z",
  "approved_at": "2026-08-19T12:10:00Z",
  "tx_hash_submit": "0xdef456...",
  "tx_hash_approve": "0xghi789..."
}
```

### 2.3 表：`transactions`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer, PK | 数据库主键 |
| escrow_id | Integer, FK, nullable | 关联的项目（可能为空，例如与具体 escrow 无关的操作） |
| milestone_index | Integer, nullable | 关联的 milestone 序号（非 milestone 相关操作则为空） |
| tx_hash | String(66), unique, not null | 链上交易哈希 |
| action | String(30), not null | 见下方枚举 |
| from_address | String(42), not null | 发起交易的钱包地址 |
| amount_wei | String(78), nullable | 涉及金额（如果有） |
| status | String(20), default="PENDING" | PENDING / CONFIRMED / FAILED |
| block_number | Integer, nullable | 交易被打包的区块号，确认后回填 |
| created_at | DateTime, default=now | 记录创建时间（前端提交交易时立即写入 PENDING） |
| confirmed_at | DateTime, nullable | 链上确认时间 |

`action` 取值枚举：
`CREATE_ESCROW` / `FUND_ESCROW` / `SUBMIT_MILESTONE` / `APPROVE_MILESTONE` / `RAISE_DISPUTE` / `RESOLVE_DISPUTE` / `REFUND`

```json
{
  "id": 12,
  "escrow_id": 1,
  "milestone_index": 1,                       // M2，非 milestone 相关操作（如 FUND_ESCROW）此字段为 null
  "tx_hash": "0xghi789...",
  "action": "APPROVE_MILESTONE",               // 见上方枚举
  "from_address": "0x123abc...",               // 通常是 client_address
  "amount_wei": "300000000000000000",          // 本次释放的 0.3 ETH
  "status": "CONFIRMED",                       // PENDING | CONFIRMED | FAILED
  "block_number": 5231099,
  "created_at": "2026-08-19T12:09:50Z",
  "confirmed_at": "2026-08-19T12:10:05Z"
}
```

### 2.4 ER 关系图

```text
escrows (1) ──────< (N) milestones
   │  escrow_id            │ escrow_id + milestone_index
   │
   └──────────────< (N) transactions
              escrow_id (nullable) + milestone_index (nullable)
```

---

## 三、字段命名与类型约定（贯穿前后端）

- **金额一律用字符串存 wei**，不要用 float（避免 JS/Python 浮点精度问题）；前端展示时用 `ethers.formatEther()` 转成 ETH
- **地址一律小写或保持 checksum 格式统一**，建议存的时候用 `ethers.getAddress()` 转成标准 checksum 格式，避免同一地址大小写不一致导致查询不到
- **时间字段统一 ISO 8601 UTC 字符串**（如 `2026-08-19T12:10:05Z`），链上的 `uint256 timestamp` 是 unix 秒，后端转换后再存入 SQLite
- **状态字段用字符串枚举而不是数字**，虽然链上是 `enum`（数字），但落库和 API 返回时统一转成可读字符串，减少前端心智负担

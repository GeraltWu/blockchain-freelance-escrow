# 接口文档 — Freelance Milestone Escrow DApp

接口分两大类：
- **A. Flask REST API**（前端 ↔ 后端，负责元数据/展示/历史记录）
- **B. Smart Contract 接口**（前端 ↔ MetaMask ↔ 合约，负责真正的资金操作）

两类接口的调用顺序通常是：**先调 B（链上操作，需要签名），交易确认后再调 A（把结果同步进数据库，供列表/历史页面查询）**。

Base URL（本地开发）：`http://127.0.0.1:5000/api`

---

# A. Flask REST API

## 模块一：Escrow 项目模块

### 1.1 获取项目列表

```
GET /api/escrows
```

**输入参数（Query String）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| address | string | 否 | 按钱包地址过滤（客户或自由职业者） |
| role | string | 否 | 配合 address 使用，`client` / `freelancer` / `arbitrator`，不传则三者都匹配 |
| status | string | 否 | 按状态过滤：`CREATED`/`FUNDED`/`COMPLETED`/`CANCELLED` |
| page | integer | 否 | 页码，默认 1 |
| page_size | integer | 否 | 每页条数，默认 10，最大 50 |

**请求示例**
```
GET /api/escrows?address=0x123abc...&role=client&status=FUNDED&page=1&page_size=10
```

**输出参数**

| 字段 | 类型 | 说明 |
|---|---|---|
| total | integer | 符合条件的总条数 |
| page | integer | 当前页码 |
| page_size | integer | 每页条数 |
| items | array | Escrow 对象数组，字段见「数据模型文档 2.1」 |

**响应示例**
```json
{
  "total": 2,                        // 总共 2 条符合条件的记录
  "page": 1,
  "page_size": 10,
  "items": [
    {
      "escrow_id": 1,                // 链上 escrowId，操作合约时要用它
      "client_address": "0x123abc...",
      "freelancer_address": "0x456def...",
      "arbitrator_address": "0x789ghi...",
      "title": "个人作品集网站开发",
      "total_amount_wei": "1000000000000000000",  // 1 ETH
      "status": "FUNDED",
      "deadline": "2026-12-01T00:00:00Z",
      "created_at": "2026-08-19T10:00:00Z"
    }
  ]
}
```

---

### 1.2 获取项目详情

```
GET /api/escrows/<escrow_id>
```

**输入参数（Path）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| escrow_id | integer | 是 | 链上 escrowId |

**请求示例**
```
GET /api/escrows/1
```

**响应示例（成功 200）**
```json
{
  "escrow_id": 1,
  "client_address": "0x123abc...",
  "freelancer_address": "0x456def...",
  "arbitrator_address": "0x789ghi...",
  "title": "个人作品集网站开发",
  "description": "需要一个响应式的个人网站，包含首页/项目页/联系页",
  "total_amount_wei": "1000000000000000000",
  "status": "FUNDED",
  "deadline": "2026-12-01T00:00:00Z",
  "tx_hash_create": "0xabc123...",
  "created_at": "2026-08-19T10:00:00Z",
  "updated_at": "2026-08-19T10:35:00Z",
  "milestones": [                       // 详情接口顺带返回该项目的 milestone 列表，
                                         // 前端不用再多发一次请求
    {
      "milestone_index": 0,
      "description": "UI Design",
      "amount_wei": "200000000000000000",
      "status": "RELEASED"
    }
  ]
}
```

**响应示例（未找到 404）**
```json
{
  "error": "ESCROW_NOT_FOUND",          // 错误码，前端可用它做 i18n 文案映射
  "message": "escrow_id=1 不存在"
}
```

---

### 1.3 创建项目元数据

链上 `createEscrow()` 交易确认后，前端调用这个接口把标题/描述这类链上不存的信息补充进数据库。

```
POST /api/escrows
```

**输入参数（Body，JSON）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| escrow_id | integer | 是 | 链上返回的 escrowId（从 `EscrowCreated` 事件里拿到） |
| client_address | string | 是 | 客户地址 |
| freelancer_address | string | 是 | 自由职业者地址 |
| arbitrator_address | string | 是 | 该项目指定的仲裁者地址（双方创建前线下协商好） |
| title | string | 是 | 项目标题，最长 120 字符 |
| description | string | 否 | 项目描述 |
| total_amount_wei | string | 是 | 总金额，字符串形式的 wei |
| deadline | string | 是 | ISO 8601 时间字符串 |
| tx_hash_create | string | 是 | 创建交易的 hash，用于溯源 |
| milestones | array | 是 | milestone 数组，见下 |

`milestones` 数组每一项：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| milestone_index | integer | 是 | 从 0 开始，必须和链上顺序一致 |
| description | string | 是 | 阶段说明 |
| amount_wei | string | 是 | 该阶段金额 |

**请求示例**
```json
{
  "escrow_id": 1,
  "client_address": "0x123abc...",
  "freelancer_address": "0x456def...",
  "arbitrator_address": "0x789ghi...",
  "title": "个人作品集网站开发",
  "description": "需要一个响应式的个人网站",
  "total_amount_wei": "1000000000000000000",
  "deadline": "2026-12-01T00:00:00Z",
  "tx_hash_create": "0xabc123...",
  "milestones": [
    { "milestone_index": 0, "description": "UI Design", "amount_wei": "200000000000000000" },
    { "milestone_index": 1, "description": "Frontend",  "amount_wei": "300000000000000000" },
    { "milestone_index": 2, "description": "Backend",   "amount_wei": "500000000000000000" }
  ]
}
```

**响应示例（成功 201）**
```json
{
  "escrow_id": 1,
  "status": "CREATED",
  "created_at": "2026-08-19T10:00:00Z"
}
```

**响应示例（校验失败 400）**
```json
{
  "error": "MILESTONE_AMOUNT_MISMATCH",   // milestone 金额之和 != total_amount_wei
  "message": "milestone 金额总和与 total_amount_wei 不一致"
}
```

---

## 模块二：Milestone 模块

### 2.1 获取某项目的 milestone 列表

```
GET /api/escrows/<escrow_id>/milestones
```

**输入参数（Path）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| escrow_id | integer | 是 | 链上 escrowId |

**响应示例**
```json
[
  {
    "milestone_index": 0,
    "description": "UI Design",
    "amount_wei": "200000000000000000",
    "status": "RELEASED",              // PENDING | SUBMITTED | DISPUTED | RELEASED | REFUNDED
    "submitted_at": "2026-08-19T11:20:00Z",
    "approved_at": "2026-08-19T12:10:00Z"
  },
  {
    "milestone_index": 1,
    "description": "Frontend",
    "amount_wei": "300000000000000000",
    "status": "SUBMITTED",
    "submitted_at": "2026-08-19T13:00:00Z",
    "approved_at": null                // 尚未批准
  }
]
```

---

> milestone 状态不再提供单独的更新接口。前端在链上交易确认后，统一调用「模块三」的
> `POST /api/transactions` 上报交易，后端根据 `action` 字段（`SUBMIT_MILESTONE` /
> `APPROVE_MILESTONE` / `RAISE_DISPUTE` / `RESOLVE_DISPUTE` / `REFUND`）自动推导并
> 更新对应 milestone 的 `status`，避免同一件事要调两个接口。

---

## 模块三：Transaction 交易历史模块

### 3.1 获取交易历史

```
GET /api/transactions
```

**输入参数（Query String）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| escrow_id | integer | 否 | 只看某个项目的交易 |
| address | string | 否 | 只看某个地址发起的交易 |
| action | string | 否 | 按操作类型过滤，见枚举 |
| page | integer | 否 | 默认 1 |
| page_size | integer | 否 | 默认 20 |

**请求示例**
```
GET /api/transactions?escrow_id=1&page=1&page_size=20
```

**响应示例**
```json
{
  "total": 4,
  "page": 1,
  "page_size": 20,
  "items": [
    {
      "tx_hash": "0xabc123...",
      "action": "CREATE_ESCROW",         // CREATE_ESCROW | FUND_ESCROW | SUBMIT_MILESTONE
                                          // | APPROVE_MILESTONE | RAISE_DISPUTE
                                          // | RESOLVE_DISPUTE | REFUND
      "from_address": "0x123abc...",
      "amount_wei": null,                // 创建操作不涉及金额，故为 null
      "status": "CONFIRMED",             // PENDING | CONFIRMED | FAILED
      "block_number": 5231001,
      "created_at": "2026-08-19T10:00:00Z",
      "confirmed_at": "2026-08-19T10:00:15Z"
    },
    {
      "tx_hash": "0xdef456...",
      "action": "FUND_ESCROW",
      "from_address": "0x123abc...",
      "amount_wei": "1000000000000000000",
      "status": "CONFIRMED",
      "block_number": 5231005,
      "created_at": "2026-08-19T10:05:00Z",
      "confirmed_at": "2026-08-19T10:05:12Z"
    }
  ]
}
```

---

### 3.2 上报一条交易记录

前端在 `tx.wait()` 拿到最终结果（成功或失败）后，**一次性**上报完整记录，不再分 PENDING/CONFIRMED 两步。
如果该交易涉及 milestone 状态变化（`action` 为 `SUBMIT_MILESTONE`/`APPROVE_MILESTONE`/`RAISE_DISPUTE`/
`RESOLVE_DISPUTE`/`REFUND`），后端会在写入这条记录的同时自动更新对应 milestone 的 `status`。

```
POST /api/transactions
```

**输入参数（Body，JSON）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| tx_hash | string | 是 | 交易哈希，唯一 |
| escrow_id | integer | 否 | 关联的项目 |
| milestone_index | integer | 否 | 关联的 milestone |
| action | string | 是 | 见枚举 |
| from_address | string | 是 | 发起地址 |
| amount_wei | string | 否 | 涉及金额 |
| status | string | 是 | `CONFIRMED` 或 `FAILED`（前端已经 `await tx.wait()` 拿到结果再上报） |
| block_number | integer | 否 | `CONFIRMED` 时建议填 |

**请求示例**
```json
{
  "tx_hash": "0xghi789...",
  "escrow_id": 1,
  "milestone_index": 1,
  "action": "APPROVE_MILESTONE",
  "from_address": "0x123abc...",
  "amount_wei": "300000000000000000",
  "status": "CONFIRMED",
  "block_number": 5231099
}
```

**响应示例（成功 201）**
```json
{
  "tx_hash": "0xghi789...",
  "status": "CONFIRMED",
  "block_number": 5231099,
  "created_at": "2026-08-19T13:01:05Z"
}
```

---

## 通用错误响应格式

所有接口出错时统一返回：

```json
{
  "error": "ERROR_CODE",          // 大写下划线风格的错误码，前端用来判断分支逻辑
  "message": "人类可读的错误说明"    // 用于直接展示给用户或写日志
}
```

常见错误码：

| 错误码 | HTTP 状态码 | 说明 |
|---|---|---|
| ESCROW_NOT_FOUND | 404 | escrow_id 不存在 |
| MILESTONE_NOT_FOUND | 404 | milestone_index 不存在 |
| MILESTONE_AMOUNT_MISMATCH | 400 | milestone 金额之和与 total 不一致 |
| DUPLICATE_TX_HASH | 409 | tx_hash 已存在（重复上报） |
| INVALID_ADDRESS | 400 | 地址格式不合法 |
| VALIDATION_ERROR | 400 | 其它字段校验失败 |

---

# B. Smart Contract 接口（Solidity，通过 ethers.js 调用）

这一部分不是 REST，而是合约的 **function 签名**，前端通过 `ethers.js` + MetaMask 直接调用，交易需要签名和 gas。

## 模块四：Escrow 合约接口

### 4.1 createEscrow — 创建项目

```solidity
function createEscrow(
    address freelancer,              // 自由职业者地址
    address arbitrator,              // 仲裁者地址，由 Client 与 Freelancer 线下协商好后指定
    uint256 deadline,                // 截止时间，unix timestamp
    string[] calldata descriptions,  // 每个 milestone 的描述
    uint256[] calldata amounts       // 每个 milestone 的金额（wei），顺序与 descriptions 对应
) external returns (uint256 escrowId);
```

- 调用者：Client（`msg.sender` 即为 client）
- 校验：`freelancer != address(0)`、`freelancer != msg.sender`、`arbitrator != address(0)`、`arbitrator != msg.sender`、`arbitrator != freelancer`、`deadline > block.timestamp`、`descriptions.length == amounts.length`、`amounts.length > 0`
- 不需要 `payable`，此步骤只登记项目结构，不转账
- 触发事件：`EscrowCreated`

**ethers.js 调用示例**
```javascript
const tx = await contract.createEscrow(
  freelancerAddress,
  arbitratorAddress,                                    // 双方协商好的仲裁地址
  Math.floor(new Date("2026-12-01").getTime() / 1000), // deadline
  ["UI Design", "Frontend", "Backend"],
  [ethers.parseEther("0.2"), ethers.parseEther("0.3"), ethers.parseEther("0.5")]
);
const receipt = await tx.wait();
// 从 receipt.logs 里解析 EscrowCreated 事件拿到 escrowId
```

---

### 4.2 fundEscrow — 存入资金

```solidity
function fundEscrow(uint256 escrowId) external payable;
```

- 调用者：必须是该 escrow 的 `client`
- 校验：`msg.value == escrow.totalAmount`（一次性全额存入）、`escrow.status == CREATED`
- 触发事件：`EscrowFunded`

**ethers.js 调用示例**
```javascript
const tx = await contract.fundEscrow(escrowId, {
  value: ethers.parseEther("1.0")
});
await tx.wait();
```

---

### 4.3 submitMilestone — 提交阶段成果

```solidity
function submitMilestone(uint256 escrowId, uint256 milestoneIndex) external;
```

- 调用者：必须是该 escrow 的 `freelancer`
- 校验：`escrow.status == FUNDED`、`milestone.status == PENDING`
- 触发事件：`MilestoneSubmitted`

---

### 4.4 approveMilestone — 批准并放款

```solidity
function approveMilestone(uint256 escrowId, uint256 milestoneIndex) external;
```

- 调用者：必须是该 escrow 的 `client`
- 校验：`milestone.status == SUBMITTED`、使用 checks-effects-interactions 模式防重入（先改状态为 `RELEASED` 再转账）
- 效果：向 `freelancer` 转账 `milestone.amount`
- 触发事件：`MilestoneApproved`

---

### 4.5 raiseDispute — 发起争议

```solidity
function raiseDispute(uint256 escrowId, uint256 milestoneIndex) external;
```

- 调用者：该 escrow 的 `client` 或 `freelancer`
- 校验：`milestone.status == SUBMITTED`（一般在提交后、批准前才允许发起争议）
- 触发事件：`DisputeRaised`

---

### 4.6 resolveDispute — 仲裁裁决

```solidity
function resolveDispute(
    uint256 escrowId,
    uint256 milestoneIndex,
    bool releaseToFreelancer  // true = 放款给 freelancer，false = 退款给 client
) external;
```

- 调用者：必须是**该项目**的 `escrow.arbitrator`（创建时由 Client 指定，每个项目可能不同，不是全局唯一，详见数据模型文档 1.5）
- 校验：`milestone.status == DISPUTED`
- 效果：按 `releaseToFreelancer` 转账给对应一方，milestone 状态改为 `RELEASED` 或 `REFUNDED`
- 触发事件：`DisputeResolved`
- 前端判断：拿当前连接地址与**该项目**的 `escrow.arbitrator` 比较，相等才展示 `Resolve` 相关按钮；非本项目仲裁者调用会被 `require` 拒绝

---

### 4.7 refund — 超时退款

```solidity
function refund(uint256 escrowId, uint256 milestoneIndex) external;
```

- 调用者：该 escrow 的 `client`
- 校验：`block.timestamp > escrow.deadline`、`milestone.status == PENDING`（freelancer 一直没提交才允许客户主动退款）
- 触发事件：`Refunded`

---

### 4.8 只读查询接口

```solidity
function getEscrow(uint256 escrowId) external view returns (Escrow memory);
function getMilestone(uint256 escrowId, uint256 milestoneIndex) external view returns (Milestone memory);
function getMilestones(uint256 escrowId) external view returns (Milestone[] memory);
function getClientEscrows(address client) external view returns (uint256[] memory);
function getFreelancerEscrows(address freelancer) external view returns (uint256[] memory);
```

这些是 `view` 函数，不消耗 gas，前端可以直接调用来实时校验/展示链上真实状态（比如 EscrowDetail 页面进入时先调一次 `getEscrow` 保证展示的是链上最新数据，而不是完全依赖 SQLite 缓存）。

---

## 权限矩阵总览

| 函数 | Client | Freelancer | Arbitrator | 任意人 |
|---|:---:|:---:|:---:|:---:|
| createEscrow | ✅ | ❌ | ❌ | ❌ |
| fundEscrow | ✅（仅本人项目） | ❌ | ❌ | ❌ |
| submitMilestone | ❌ | ✅（仅本人项目） | ❌ | ❌ |
| approveMilestone | ✅（仅本人项目） | ❌ | ❌ | ❌ |
| raiseDispute | ✅ | ✅ | ❌ | ❌ |
| resolveDispute | ❌ | ❌ | ✅（仅本人被指定为仲裁者的项目） | ❌ |
| refund | ✅（仅本人项目） | ❌ | ❌ | ❌ |
| get* (view) | ✅ | ✅ | ✅ | ✅ |

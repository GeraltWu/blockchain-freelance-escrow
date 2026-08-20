# Freelance Milestone Escrow DApp — 系统架构设计

技术栈：**React + Mantine**（前端）/ **Flask + SQLite**（后端）/ **Solidity + Remix**（智能合约）/ **Ethers.js + MetaMask**（Web3 连接层）

---

## 一、整体架构图

```text
                              ┌────────────────────┐
                              │        User         │
                              └──────────┬───────────┘
                                         │
                                         ▼
                        ┌───────────────────────────────┐
                        │      React + Mantine SPA        │
                        │  (Dashboard / Create / Detail /  │
                        │       History / Wallet)          │
                        └───────┬───────────────┬─────────┘
                                │                │
                  ethers.js /   │                │  fetch / axios
                  MetaMask      │                │  (REST API)
                                ▼                ▼
                  ┌──────────────────┐   ┌──────────────────────┐
                  │   MetaMask        │   │   Flask Backend        │
                  │   (签名 / 发交易)   │   │  (业务逻辑 / 缓存 / 索引) │
                  └────────┬──────────┘   └───────────┬───────────┘
                           │                           │
                           ▼                           ▼
                ┌────────────────────┐        ┌──────────────────┐
                │  Ethereum Sepolia   │        │  SQLite Database  │
                │  FreelanceEscrow.sol│        │ (元数据/交易索引)   │
                └──────────┬──────────┘        └──────────────────┘
                           │
              事件监听 (Events) │ 可选：后端用 web3.py 监听链上事件
                           ▼
                 写回 SQLite 做索引/展示加速
```

**核心原则（和你笔记里提到的一致）：**
- **链上（Smart Contract）= 金融真相**：Escrow 状态、资金、Milestone 状态、Approve/Dispute 结果
- **链下（Flask + SQLite）= 应用数据**：项目标题/描述、UI 需要的缓存数据、交易记录索引，方便前端做列表/搜索/分页，而不必每次都直接查链上（慢、贵）
- **前端从不直接信任自己**：所有关键校验在 Smart Contract 里必须重复一遍（`require(...)`）
- **私钥永远不经过后端**：所有签名都在 MetaMask 里完成，后端和前端都不接触私钥

---

## 二、三端各自的职责边界

| 层 | 负责什么 | 不负责什么 |
|---|---|---|
| Smart Contract | 资金托管、Milestone 状态机、权限校验、资金释放/退款 | 存储项目标题、描述这类非金融数据（省 gas） |
| Flask Backend | 提供 REST API 给前端、把链上事件索引进 SQLite、存储项目元数据 | 不能替代链上做资金判断、不能替用户签名 |
| React 前端 | 页面渲染、表单校验（第一道防线）、调用 ethers.js 发交易、调用后端 API 取展示数据 | 不做最终的资金/权限判断（那是合约的事） |

---

## 三、React 前端目录结构（Vite + Mantine）

推荐用 **Vite** 起项目（比 CRA 快很多，Mantine 官方也推荐）：

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install @mantine/core @mantine/hooks @mantine/notifications @mantine/form
npm install ethers axios
npm install @mantine/dates dayjs   # 如果 deadline 需要日期选择器
```

目录结构：

```text
frontend/
├── public/
├── src/
│   ├── main.jsx                  # 入口，包裹 MantineProvider
│   ├── App.jsx                   # 路由入口
│   │
│   ├── web3/                     # 所有链上交互集中在这里
│   │   ├── contract.js           # 合约地址 + ABI + getContract()
│   │   ├── wallet.js             # connectWallet() / 监听账户切换
│   │   └── abi/
│   │       └── FreelanceEscrow.json   # Remix 编译后导出的 ABI
│   │
│   ├── api/                      # 所有对 Flask 后端的请求集中在这里
│   │   ├── client.js             # axios 实例（baseURL, 拦截器）
│   │   ├── escrows.js            # getEscrows(), getEscrowById()
│   │   └── transactions.js       # getTransactionHistory()
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx         # Page 1
│   │   ├── CreateEscrow.jsx      # Page 2
│   │   ├── EscrowDetail.jsx      # Page 3
│   │   └── TransactionHistory.jsx# Page 4
│   │
│   ├── components/
│   │   ├── WalletButton.jsx      # Connect Wallet / 显示地址+余额
│   │   ├── EscrowCard.jsx
│   │   ├── MilestoneList.jsx
│   │   ├── MilestoneItem.jsx
│   │   ├── StatusBadge.jsx       # FUNDED / SUBMITTED / APPROVED 等状态标签
│   │   └── TxHistoryTable.jsx
│   │
│   ├── context/
│   │   └── WalletContext.jsx     # 全局钱包状态 (address, provider, signer)
│   │
│   ├── hooks/
│   │   ├── useContract.js
│   │   └── useEscrow.js
│   │
│   ├── utils/
│   │   ├── format.js             # wei <-> ETH 格式化, 地址缩写
│   │   └── validators.js         # 前端表单校验规则（Mantine useForm 用）
│   │
│   └── theme.js                  # Mantine 自定义主题
│
├── .env                          # VITE_CONTRACT_ADDRESS / VITE_API_BASE_URL / VITE_CHAIN_ID
├── package.json
└── vite.config.js
```

**Mantine 用法要点：**
- 用 `AppShell` 做整体布局（顶部 Navbar 放 WalletButton，左侧 Nav 放 Dashboard/Create/History）
- 用 `useForm`（`@mantine/form`）做 Create Escrow 表单校验，例如 milestone 金额之和必须等于 total
- 用 `notifications`（`@mantine/notifications`）在交易 pending/success/fail 时弹通知，替代 `alert()`
- 用 `Badge`/`Timeline` 组件展示 Milestone 状态和状态机流转，视觉效果比纯文字好很多

---

## 四、Flask 后端目录结构

```text
backend/
├── app/
│   ├── __init__.py               # create_app() 工厂函数
│   ├── config.py                 # 配置（SQLite 路径, Sepolia RPC URL, 合约地址）
│   ├── extensions.py             # db = SQLAlchemy()
│   │
│   ├── models/
│   │   ├── escrow.py             # Escrow 元数据表（title, description, 缓存的链上状态）
│   │   ├── milestone.py
│   │   └── transaction.py        # 交易索引表（tx_hash, action, amount, status, timestamp）
│   │
│   ├── routes/
│   │   ├── escrows.py            # GET /api/escrows, GET /api/escrows/<id>
│   │   ├── transactions.py       # GET /api/transactions
│   │   └── projects.py           # POST /api/projects  (创建元数据，链上创建后调用)
│   │
│   ├── services/
│   │   ├── chain_listener.py     # 可选：用 web3.py 监听合约 Event，写入 SQLite
│   │   └── indexer.py            # 把链上 event 转换成可读的 transaction 记录
│   │
│   └── utils/
│       └── validators.py         # 后端二次校验（不能全信前端）
│
├── instance/
│   └── app.db                    # SQLite 文件
│
├── tests/
│   ├── test_escrows.py
│   └── test_transactions.py
│
├── .env                          # SQLITE_PATH / SEPOLIA_RPC_URL / CONTRACT_ADDRESS
├── requirements.txt
└── run.py                        # flask run 入口
```

**requirements.txt 核心依赖：**
```text
flask
flask-sqlalchemy
flask-cors
python-dotenv
web3            # 可选，用于监听链上事件/校验交易
```

**API 设计（对应你笔记里的接口）：**
```text
GET  /api/escrows                 -> 列表（读缓存的链上状态 + 元数据）
GET  /api/escrows/<id>            -> 详情
GET  /api/escrows/<id>/milestones -> milestone 列表
GET  /api/transactions?escrow_id= -> 交易历史
POST /api/projects                -> 保存链下元数据（标题/描述），需带上链上 escrowId
```

> 关键点：**Flask 不负责“批准/放款”这类操作** —— 这些请求应该直接由前端调用 `ethers.js -> MetaMask -> 合约`，Flask 只是在交易确认后，把结果（可以来自事件监听，也可以来自前端在交易成功回调里主动 POST 一条记录）落进 SQLite 用于展示。

---

## 五、智能合约（Remix）

Remix 是浏览器 IDE，不需要装本地开发环境，适合个人项目快速迭代：

```text
contracts/
└── FreelanceEscrow.sol
```

**在 Remix 里的开发流程：**

1. 打开 `remix.ethereum.org`
2. 新建 `FreelanceEscrow.sol`，写合约
3. 左侧 **Solidity Compiler** 面板编译，编译成功后点击 **ABI** 按钮复制 ABI
4. 把 ABI 保存为 `frontend/src/web3/abi/FreelanceEscrow.json`
5. 左侧 **Deploy & Run Transactions** 面板：
   - Environment 选择 **Injected Provider - MetaMask**
   - 确认 MetaMask 网络切到 **Sepolia**
   - 点击 Deploy，MetaMask 弹窗确认
6. 部署成功后复制 **Contract Address**，写入前端 `.env` 的 `VITE_CONTRACT_ADDRESS`
7. 之后每次改合约逻辑，重复 3-6 步重新部署（测试网可以随便重新部署，地址会变，记得同步更新 `.env`）

**建议同时保留一份合约源码在你自己的 git 仓库里**（`contracts/FreelanceEscrow.sol`），Remix 只是运行环境，不要把它当唯一的代码存档地点。

---

## 六、目录结构总览（Monorepo 建议）

个人项目建议用一个 repo 装三块内容，方便管理和答辩时展示：

```text
freelance-escrow-dapp/
├── contracts/
│   └── FreelanceEscrow.sol
│
├── frontend/                # React + Mantine
│   └── ...(见上)
│
├── backend/                 # Flask + SQLite
│   └── ...(见上)
│
├── docs/
│   ├── architecture.md      # 本文档
│   ├── requirements.md      # 下一步要定的 Functional Requirements
│   └── screenshots/         # Testing 部分要求的截图
│
└── README.md
```

---

## 七、本地开发环境搭建步骤

### 1. 智能合约（不需要本地环境，只需要浏览器）
- MetaMask 浏览器插件，切换到 **Sepolia Testnet**
- 去水龙头领测试 ETH（如 `sepoliafaucet.com`，需要先搜索确认当前可用的水龙头）
- Remix（`remix.ethereum.org`）在线编写、编译、部署

### 2. 后端环境
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask --app run.py run --debug   # 默认 http://127.0.0.1:5000
```
`.env` 示例：
```text
FLASK_ENV=development
SQLITE_PATH=instance/app.db
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<你的项目ID>
CONTRACT_ADDRESS=0x...
```

### 3. 前端环境
```bash
cd frontend
npm install
npm run dev    # 默认 http://localhost:5173
```
`.env` 示例：
```text
VITE_API_BASE_URL=http://127.0.0.1:5000/api
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=11155111   # Sepolia
```

### 4. 跨域
Flask 需要装 `flask-cors` 并允许 `http://localhost:5173`，否则前端调 API 会被浏览器拦。

---

## 八、一次典型交易的完整数据流（以 Approve Milestone 为例）

```text
1. Client 在 EscrowDetail.jsx 点击 [Approve]
2. 前端 useEscrow.js 调用 contract.approveMilestone(escrowId, milestoneId)
3. MetaMask 弹窗，Client 确认并签名
4. 交易广播到 Sepolia，前端拿到 txHash，用 Mantine notification 显示 "Pending..."
5. 等待 tx.wait() 确认后：
   a. 前端本地更新 UI 状态为 APPROVED
   b. 前端调用 POST /api/transactions，把 txHash/action/amount 写入 Flask -> SQLite
      （或者：后端 chain_listener.py 监听 MilestoneApproved 事件自动写入，更严谨但更复杂）
6. Dashboard / History 页面从 GET /api/escrows、GET /api/transactions 读取展示
```

这样保证：**资金状态的最终判断永远来自链上**，SQLite 只是加速展示用的镜像数据，即使 SQLite 数据丢了也能通过重新监听链上事件恢复。

---

需要我接下来帮你把 **Functional Requirements 清单**（Client/Freelancer/Contract 各自能做什么、每个 Transaction 的输入输出）写成文档吗？定完这个之后再进 Remix 写合约代码会顺很多。

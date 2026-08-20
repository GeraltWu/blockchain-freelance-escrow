# UI 界面设计文档 — Freelance Milestone Escrow DApp

设计基于 **Mantine** 组件库，整体走"清爽的金融工具"风格，不做过度装饰，重点让人一眼看懂"钱在哪个状态"。

---

## 一、整体视觉风格

- **色彩基调**：以 Mantine 默认的 `blue` 或 `indigo` 作为主色（代表信任/金融），中性灰白背景，避免用太跳的颜色，符合托管类产品该有的"稳重感"
- **状态色是唯一的强调色系统**：整个界面里，颜色主要用来区分状态（见下方状态色规范），而不是随意装饰，这样用户扫一眼列表就能看出哪些项目/阶段需要自己处理
- **字体/密度**：数字（金额、地址、哈希）用等宽字体（`font-family: monospace`）展示，和普通文字（标题、描述）区分开，符合区块链产品的阅读习惯
- **深色模式**：Mantine 自带 `ColorSchemeToggle`，直接开启即可，不用额外设计

### 状态色规范（贯穿全站）

| 状态 | 颜色 | Mantine Badge color |
|---|---|---|
| CREATED / PENDING | 灰色 | `gray` |
| FUNDED | 蓝色 | `blue` |
| SUBMITTED | 黄色/橙色 | `yellow` |
| DISPUTED | 红色 | `red` |
| RELEASED / COMPLETED | 绿色 | `green` |
| REFUNDED / CANCELLED | 深灰 | `dark` |

---

## 二、整体布局结构

用 Mantine 的 `AppShell` 搭骨架，分三部分：

```
┌─────────────────────────────────────────────────────┐
│ Header：Logo + 网络标识(Sepolia) + Wallet 按钮          │
├───────────┬───────────────────────────────────────────┤
│           │                                             │
│  Navbar   │              主内容区域                     │
│ (左侧导航)  │        （Dashboard/Create/Detail/History）  │
│           │                                             │
└───────────┴───────────────────────────────────────────┘
```

**Header（顶部栏，全站固定）**
- 左侧：项目 Logo + 名称
- 中间：一个小徽章显示当前钱包连接的网络名称，如 `● Sepolia Testnet`，纯展示用，不做额外的主动校验/提示逻辑（网络不对的处理方式见下方「跨页面交互细节」）
- 右侧：**Wallet 按钮**，这是全站最重要的常驻组件，分三种状态：
  - 未连接：按钮文字 `Connect Wallet`，纯色填充，比较醒目
  - 连接中：按钮变 loading 状态（Mantine `loading` prop），文字变灰
  - 已连接：显示缩写地址（如 `0x71C...8A2`）+ 余额（如 `1.52 ETH`），点击弹出下拉菜单（Disconnect / 查看区块浏览器链接）

**Navbar（左侧导航，桌面端常驻，移动端折叠成汉堡菜单）**
- Dashboard（首页图标）
- Create Escrow（加号图标）
- Transaction History（时钟/列表图标）
- 当前选中项高亮（Mantine `NavLink` 的 active 状态）

---

## 三、Page 1：Dashboard（首页）

**用途**：一进来就知道"我手上有哪些项目，哪些需要我处理"。

**结构从上到下：**

1. **顶部统计卡片区**（一行 3-4 个 `Card`，横向排列，移动端自动堆叠）
   - Active Projects（进行中项目数）
   - Total Locked Funds（我作为 Client 锁在合约里的总金额）
   - Pending Actions（需要我处理的事项数，比如有 milestone 待我 approve）
   - Completed Projects（已完成项目数）

2. **角色切换 Tab**（Mantine `SegmentedControl` 或 `Tabs`）：`As Client` / `As Freelancer`，因为同一个钱包地址既可能是某些项目的客户，也可能是另一些项目的自由职业者，两种视角下"需要我做的事"不一样（Client 要 approve，Freelancer 要 submit）

3. **项目列表**（卡片列表，每张 `Card` 代表一个 Escrow）
   每张卡片包含：
   - 项目标题
   - 对方地址（缩写显示，旁边一个复制图标）
   - 状态 Badge（用上面的状态色规范）
   - 进度条（Mantine `Progress`）：已释放金额 / 总金额，直观展示项目完成度
   - 右下角一个"待处理"小红点标记（如果这个项目有需要我立即处理的 milestone）
   - 点击整张卡片跳转到 Escrow Detail 页

4. **空状态**：如果没有任何项目，中间显示一个插画风格的空状态提示（Mantine 没有内置空状态组件，可以简单用图标+文字），文案类似"还没有进行中的项目，创建一个开始吧"，配一个跳转到 Create Escrow 的按钮

---

## 四、Page 2：Create Escrow（创建项目）

**用途**：Client 发起一个新项目，这是表单最复杂的一个页面，需要分步引导，避免用户一次性面对太多输入框。

**建议用 Mantine 的 `Stepper` 组件分三步：**

**Step 1 — 基本信息**
- Freelancer 钱包地址（`TextInput`，失焦时校验格式是否是合法以太坊地址，非法则红框+错误文案）
- 项目标题（`TextInput`）
- 项目描述（`Textarea`）
- 截止日期（`DatePickerInput`，限制不能选过去的日期）

**Step 2 — Milestone 设置**
- 动态表单：一开始展示一行 Milestone 输入（描述 + 金额），下方有 `+ Add Milestone` 按钮可以继续加行，每行右侧有删除图标
- 每行：`TextInput`（描述）+ `NumberInput`（金额，单位 ETH，限制只能输正数、最多小数点后 6 位）
- 底部实时显示：**Total: X ETH**（自动求和），如果用户后面在 Step 3 看到的总额和这里对不上会有提示（但因为是同一个表单状态，理论上不会对不上，这里更多是给用户一个确认视觉）
- 至少要有 1 条 milestone 才能进入下一步（校验用 Mantine `useForm` 的 rules）

**Step 3 — 确认信息**
- 用只读的方式把 Step 1/2 填的内容汇总展示一遍（类似订单确认页），列出：Freelancer 地址、截止日期、每个 Milestone 明细、Total 金额
- 底部两个按钮：
  - `Create Escrow`：触发链上 `createEscrow()` 交易（只登记结构，不转账）
  - 交易发出后按钮变 loading，Mantine `notifications` 弹出"等待钱包确认..."→"交易已提交，等待上链..."→"创建成功！"三段式提示
- **创建成功后**：自动询问是否立即存入资金（`fundEscrow()`），用一个 `Modal` 弹窗二次确认金额，因为这是真金白银转账，值得单独一次确认，而不是自动连着创建一起做

---

## 五、Page 3：Escrow Detail（项目详情）

**用途**：整个产品的核心操作页，Client 和 Freelancer 都在这里完成绝大部分操作。**同一个页面，根据当前连接的钱包地址是 client 还是 freelancer，动态显示不同的可操作按钮**（这是这个页面设计的关键点，不用做成两个页面）。

**结构从上到下：**

1. **顶部信息条**：项目标题 + 状态 Badge（大号）+ 对方地址 + 截止日期倒计时（如"还剩 15 天"，临近截止时变橙色/红色提醒）

2. **金额概览卡片**：一个横向进度条，标注 `Total 1 ETH` / `Released 0.2 ETH` / `Locked 0.8 ETH`，用不同颜色分段展示（已释放/锁定中）

3. **Milestone 列表**（这是页面的主体，用 Mantine `Timeline` 组件最合适，纵向时间线天然契合"阶段性推进"的语义）
   每个 Timeline 节点包含：
   - 节点图标颜色对应状态色规范
   - Milestone 标题 + 金额
   - 状态 Badge
   - **右侧操作按钮区**（根据角色+状态动态显示，这是最关键的交互逻辑）：
     - 我是 Freelancer，状态=PENDING → 显示 `Submit` 按钮
     - 我是 Client，状态=SUBMITTED → 显示 `Approve` 按钮（绿色主按钮）+ `Raise Dispute` 按钮（次要按钮，红色文字）
     - 我是 Freelancer，状态=SUBMITTED → 只显示"等待客户确认"的灰色文字，不显示按钮（不是我这一步该做的事）
     - 状态=DISPUTED，且我是 Arbitrator 地址 → 显示 `Resolve: Release to Freelancer` / `Resolve: Refund to Client` 两个按钮
     - 状态=RELEASED/REFUNDED → 不显示按钮，只显示一个小小的"已完成"勾选图标 + 完成时间
   - 每个关键操作点击后都用 Mantine `Modal` 做二次确认（尤其是 Approve，因为直接触发转账），弹窗里注明"这将从合约释放 X ETH 给 0x456...，此操作不可撤销"

4. **相关交易记录**（页面底部一个简化的小表格，只显示和当前项目相关的交易，点击"查看全部"跳到 Transaction History 页并自动带上 escrow_id 过滤条件）

---

## 六、Page 4：Transaction History（交易历史）

**用途**：审计视角，把所有交易按时间倒序列出来，对应老师要求的"display transaction status/history"。

**结构：**

1. **顶部筛选栏**：
   - 项目筛选（下拉选择某个 Escrow，或"All Projects"）
   - 操作类型筛选（多选：Create / Fund / Submit / Approve / Dispute / Refund）
   - 状态筛选（Pending / Confirmed / Failed）

2. **表格主体**（Mantine `Table`，列如下）：

   | Time | Project | Action | Amount | Status | Tx Hash |
   |---|---|---|---|---|---|

   - Action 列用小图标+文字组合（比如放款用 ↗ 图标，退款用 ↙ 图标），比纯文字更容易扫读
   - Amount 列右对齐，方便竖着看数字对齐
   - Status 列用 Badge
   - Tx Hash 列显示缩写（如 `0xabc1...23de`），点击直接跳转到 Sepolia 区块浏览器（Etherscan Sepolia）查看完整交易详情，这一步很重要——**证明这是真实链上交易而不是前端模拟数据**
   - 每行左侧可展开（Mantine `Table` 配合 collapse），展开后显示 `from_address`、`block_number` 等更详细字段，避免主表格太挤

3. **分页**（Mantine `Pagination`，配合后端已经设计好的 `page`/`page_size` 参数）

---

## 七、跨页面的交互细节

- **所有链上写操作**（create/fund/submit/approve/dispute/refund）统一走同一套反馈模式：按钮 loading → Mantine `notifications` 三段式提示（等待签名 → 等待上链确认 → 成功/失败）→ 成功后自动刷新当前页面数据（重新调用 `getEscrow`/`getMilestones` 或刷新 API 列表），**不需要用户手动刷新页面**
- **未连接钱包时**：任何需要签名的按钮改为 disabled，`Tooltip` 提示"请先连接钱包"，而不是让用户点击后才报错
- **网络不对时**（比如用户钱包连的不是合约部署的目标网络）：不做全局常驻检测，交易发起后如果因为网络不对失败，直接在那次操作的 `notifications` 失败提示里说明原因（"交易失败：请确认钱包连接的是 Sepolia 测试网"），按被动兜底处理，不用额外做一套主动监控 + 横幅 + 一键切换的机制
- **地址展示统一规则**：全站所有地址都显示为 `0x1234...5678` 缩写格式 + 一个复制图标，点击复制整地址到剪贴板，Mantine `notifications` 弹出"已复制"小提示

---

需要我接下来把这套设计转成 Mantine 组件的具体代码结构（比如每个 Page 对应哪些 `.jsx` 文件里写哪些具体组件），还是先进 Remix 写 `FreelanceEscrow.sol` 合约代码？

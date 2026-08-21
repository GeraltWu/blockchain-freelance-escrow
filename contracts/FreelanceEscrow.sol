// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FreelanceEscrow — 自由职业里程碑托管支付
/// @notice 资金托管与条件式付款的链上实现。
///         状态机与数据模型见 docs/data-model.md,函数签名与校验规则见 docs/api-spec.md「B. Smart Contract 接口」。
///         核心原则(初步设计.md 十七):合约不信任前端,所有关键校验在合约内重做;
///         资金真相只存在于本合约,SQLite 仅是链下展示镜像。
contract FreelanceEscrow {
    // ---------- 枚举(docs/data-model.md 1.1) ----------
    enum EscrowStatus {
        CREATED,   // 已创建,尚未存入资金
        FUNDED,    // 客户已存入全部资金,项目进行中
        COMPLETED, // 所有 milestone 都已 RELEASED
        CANCELLED  // 已退款/取消
    }

    enum MilestoneStatus {
        PENDING,   // 尚未开始
        SUBMITTED, // Freelancer 已提交,等待 Client 审核
        DISPUTED,  // 有争议,等待 Arbitrator 处理
        RELEASED,  // 资金已释放给 Freelancer(终态)
        REFUNDED   // 资金已退回给 Client(终态)
    }

    // ---------- 结构体(docs/data-model.md 1.2 / 1.3) ----------
    struct Escrow {
        uint256 id;             // 全局自增 id,即链下数据库的 escrow_id
        address client;
        address freelancer;
        uint256 totalAmount;    // 所有 milestone.amount 之和
        uint256 fundedAmount;   // 实际存入金额(= totalAmount,一次性全额存入)
        uint256 deadline;       // unix 秒
        EscrowStatus status;
        uint256 milestoneCount;
        uint256 createdAt;
    }

    struct Milestone {
        uint256 index;          // 在该 escrow 内的序号,0 起(M1 = index 0)
        string description;
        uint256 amount;
        MilestoneStatus status;
        uint256 submittedAt;    // 0 = 尚未提交
        uint256 approvedAt;     // 放款时间;REFUNDED 时记录退款时间
    }

    // ---------- 存储(docs/data-model.md 1.4) ----------
    mapping(uint256 => Escrow) public escrows;                 // escrowId => Escrow
    mapping(uint256 => Milestone[]) public escrowMilestones;   // escrowId => Milestone[]
    mapping(address => uint256[]) public clientEscrows;        // client 地址 => escrowId[]
    mapping(address => uint256[]) public freelancerEscrows;    // freelancer 地址 => escrowId[]
    address public arbitrator;                                 // 仲裁地址(Contract Owner 兼任)
    uint256 public nextEscrowId;                               // 自增计数器,第一个项目 id = 0

    // ---------- 事件(docs/data-model.md 1.5,链下索引依赖) ----------
    event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed freelancer, uint256 totalAmount, uint256 deadline);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event MilestoneSubmitted(uint256 indexed escrowId, uint256 indexed milestoneIndex);
    event MilestoneApproved(uint256 indexed escrowId, uint256 indexed milestoneIndex, uint256 amountReleased);
    event DisputeRaised(uint256 indexed escrowId, uint256 indexed milestoneIndex, address raisedBy);
    event DisputeResolved(uint256 indexed escrowId, uint256 indexed milestoneIndex, bool releasedToFreelancer);
    event Refunded(uint256 indexed escrowId, uint256 amount);

    constructor() {
        arbitrator = msg.sender;
    }

    // ---------- 访问控制修饰器(初步设计.md 十八.1) ----------
    modifier onlyClient(uint256 escrowId) {
        require(escrows[escrowId].client == msg.sender, "Only client can call");
        _;
    }

    modifier onlyFreelancer(uint256 escrowId) {
        require(escrows[escrowId].freelancer == msg.sender, "Only freelancer can call");
        _;
    }

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Only arbitrator can call");
        _;
    }

    modifier validMilestone(uint256 escrowId, uint256 milestoneIndex) {
        require(milestoneIndex < escrows[escrowId].milestoneCount, "Milestone index out of range");
        _;
    }

    // ---------- 核心函数(docs/api-spec.md 模块四) ----------

    /// @notice Client 创建项目(只登记结构,不转账)
    /// @param descriptions 每个 milestone 的描述,顺序与 amounts 对应
    /// @param amounts      每个 milestone 的金额(wei)
    function createEscrow(
        address freelancer,
        uint256 deadline,
        string[] calldata descriptions,
        uint256[] calldata amounts
    ) external returns (uint256 escrowId) {
        require(freelancer != address(0), "Freelancer is zero address");
        require(freelancer != msg.sender, "Freelancer cannot be client");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(descriptions.length == amounts.length, "Descriptions and amounts length mismatch");
        require(amounts.length > 0, "At least one milestone required");

        escrowId = nextEscrowId++;

        Escrow storage escrow = escrows[escrowId];
        escrow.id = escrowId;
        escrow.client = msg.sender;
        escrow.freelancer = freelancer;
        escrow.deadline = deadline;
        escrow.status = EscrowStatus.CREATED;
        escrow.milestoneCount = descriptions.length;
        escrow.createdAt = block.timestamp;

        Milestone[] storage milestones = escrowMilestones[escrowId];
        uint256 total;
        for (uint256 i = 0; i < descriptions.length; i++) {
            require(amounts[i] > 0, "Milestone amount must be > 0");
            require(bytes(descriptions[i]).length > 0, "Milestone description required");
            total += amounts[i];
            milestones.push(
                Milestone({
                    index: i,
                    description: descriptions[i],
                    amount: amounts[i],
                    status: MilestoneStatus.PENDING,
                    submittedAt: 0,
                    approvedAt: 0
                })
            );
        }
        escrow.totalAmount = total;

        clientEscrows[msg.sender].push(escrowId);
        freelancerEscrows[freelancer].push(escrowId);

        emit EscrowCreated(escrowId, msg.sender, freelancer, total, deadline);
    }

    /// @notice Client 一次性全额存入资金,项目进入 FUNDED
    function fundEscrow(uint256 escrowId) external payable onlyClient(escrowId) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.CREATED, "Escrow is not in CREATED state");
        require(msg.value == escrow.totalAmount, "Must fund exactly totalAmount");

        escrow.fundedAmount = msg.value;
        escrow.status = EscrowStatus.FUNDED;

        emit EscrowFunded(escrowId, msg.value);
    }

    /// @notice Freelancer 提交某个 milestone 的成果
    function submitMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyFreelancer(escrowId)
        validMilestone(escrowId, milestoneIndex)
    {
        require(escrows[escrowId].status == EscrowStatus.FUNDED, "Escrow is not funded");
        Milestone storage milestone = escrowMilestones[escrowId][milestoneIndex];
        require(milestone.status == MilestoneStatus.PENDING, "Milestone is not pending");

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.submittedAt = block.timestamp;

        emit MilestoneSubmitted(escrowId, milestoneIndex);
    }

    /// @notice Client 批准并放款:资金释放给 Freelancer(approve 与 release 同一笔交易)
    function approveMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyClient(escrowId)
        validMilestone(escrowId, milestoneIndex)
    {
        Escrow storage escrow = escrows[escrowId];
        Milestone storage milestone = escrowMilestones[escrowId][milestoneIndex];
        require(milestone.status == MilestoneStatus.SUBMITTED, "Milestone is not submitted");

        // checks-effects-interactions:先改状态再转账,防重入(初步设计.md 十八.2)
        milestone.status = MilestoneStatus.RELEASED;
        milestone.approvedAt = block.timestamp;
        if (_allMilestonesTerminal(escrowId)) {
            escrow.status = EscrowStatus.COMPLETED;
        }

        _sendEth(escrow.freelancer, milestone.amount);

        emit MilestoneApproved(escrowId, milestoneIndex, milestone.amount);
    }

    /// @notice Client 或 Freelancer 对已提交的 milestone 发起争议
    function raiseDispute(uint256 escrowId, uint256 milestoneIndex)
        external
        validMilestone(escrowId, milestoneIndex)
    {
        Escrow storage escrow = escrows[escrowId];
        Milestone storage milestone = escrowMilestones[escrowId][milestoneIndex];
        require(
            msg.sender == escrow.client || msg.sender == escrow.freelancer,
            "Only client or freelancer can raise dispute"
        );
        require(milestone.status == MilestoneStatus.SUBMITTED, "Only submitted milestones can be disputed");

        milestone.status = MilestoneStatus.DISPUTED;

        emit DisputeRaised(escrowId, milestoneIndex, msg.sender);
    }

    /// @notice Arbitrator 裁决:releaseToFreelancer=true 放款给 Freelancer,否则退款给 Client
    function resolveDispute(uint256 escrowId, uint256 milestoneIndex, bool releaseToFreelancer)
        external
        onlyArbitrator()
        validMilestone(escrowId, milestoneIndex)
    {
        Escrow storage escrow = escrows[escrowId];
        Milestone storage milestone = escrowMilestones[escrowId][milestoneIndex];
        require(milestone.status == MilestoneStatus.DISPUTED, "Milestone is not disputed");

        // checks-effects-interactions:先改状态再转账
        if (releaseToFreelancer) {
            milestone.status = MilestoneStatus.RELEASED;
            milestone.approvedAt = block.timestamp;
            if (_allMilestonesTerminal(escrowId)) {
                escrow.status = EscrowStatus.COMPLETED;
            }
            _sendEth(escrow.freelancer, milestone.amount);
        } else {
            milestone.status = MilestoneStatus.REFUNDED;
            milestone.approvedAt = block.timestamp;
            if (_allMilestonesTerminal(escrowId)) {
                escrow.status = EscrowStatus.CANCELLED;
            }
            _sendEth(escrow.client, milestone.amount);
            emit Refunded(escrowId, milestone.amount);
        }

        emit DisputeResolved(escrowId, milestoneIndex, releaseToFreelancer);
    }

    /// @notice 超时退款:截止日后,Client 可对一直未提交的 milestone 拿回对应资金
    function refund(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyClient(escrowId)
        validMilestone(escrowId, milestoneIndex)
    {
        Escrow storage escrow = escrows[escrowId];
        Milestone storage milestone = escrowMilestones[escrowId][milestoneIndex];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow is not funded");
        require(block.timestamp > escrow.deadline, "Deadline has not passed");
        require(milestone.status == MilestoneStatus.PENDING, "Only pending milestones can be refunded");

        // checks-effects-interactions:先改状态再转账
        milestone.status = MilestoneStatus.REFUNDED;
        milestone.approvedAt = block.timestamp;
        if (_allMilestonesTerminal(escrowId)) {
            escrow.status = EscrowStatus.CANCELLED;
        }

        _sendEth(escrow.client, milestone.amount);

        emit Refunded(escrowId, milestone.amount);
    }

    // ---------- 只读查询(docs/api-spec.md 4.8,不耗 gas) ----------

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        view
        validMilestone(escrowId, milestoneIndex)
        returns (Milestone memory)
    {
        return escrowMilestones[escrowId][milestoneIndex];
    }

    function getMilestones(uint256 escrowId) external view returns (Milestone[] memory) {
        return escrowMilestones[escrowId];
    }

    function getClientEscrows(address client) external view returns (uint256[] memory) {
        return clientEscrows[client];
    }

    function getFreelancerEscrows(address freelancer) external view returns (uint256[] memory) {
        return freelancerEscrows[freelancer];
    }

    // ---------- 内部函数 ----------

    // 所有 milestone 都处于终态(RELEASED / REFUNDED)
    function _allMilestonesTerminal(uint256 escrowId) internal view returns (bool) {
        Milestone[] storage milestones = escrowMilestones[escrowId];
        for (uint256 i = 0; i < milestones.length; i++) {
            MilestoneStatus s = milestones[i].status;
            if (
                s == MilestoneStatus.PENDING ||
                s == MilestoneStatus.SUBMITTED ||
                s == MilestoneStatus.DISPUTED
            ) {
                return false;
            }
        }
        return true;
    }

    // 转账封装:Solidity 0.8 的 call 失败不会自动回滚,必须显式 require
    function _sendEth(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    // 只允许通过 fundEscrow 存入资金,误转入的 ETH 直接拒绝
    receive() external payable {
        revert("Use fundEscrow to deposit funds");
    }
}

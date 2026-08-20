// 后端 API 返回的 escrow(详情含 milestones)→ Dashboard 卡片所需结构
// 同时根据「当前地址是 client 还是 freelancer」推导待处理事项(见 docs/ui-design.md 三.2)
export function mapEscrowToCard(escrow, myAddress) {
  const role =
    escrow.client_address.toLowerCase() === myAddress.toLowerCase() ? 'client' : 'freelancer'
  const milestones = (escrow.milestones || []).map((m) => ({
    index: m.milestone_index,
    description: m.description,
    amountWei: m.amount_wei,
    status: m.status,
  }))

  return {
    escrow_id: escrow.escrow_id,
    role,
    title: escrow.title,
    counterparty: role === 'client' ? escrow.freelancer_address : escrow.client_address,
    totalWei: escrow.total_amount_wei,
    status: escrow.status,
    milestones,
    pendingLabel: derivePendingLabel(milestones, role),
  }
}

// 待处理推导:client 看 SUBMITTED(freelancer 已提交,等你确认),
// freelancer 看 PENDING(该提交了);DISPUTED 等仲裁方处理,双方都无操作
function derivePendingLabel(milestones, role) {
  if (role === 'client') {
    const m = milestones.find((x) => x.status === 'SUBMITTED')
    return m ? `M${m.index + 1} submitted — awaiting your approval` : null
  }
  const m = milestones.find((x) => x.status === 'PENDING')
  return m ? `M${m.index + 1} ready to submit` : null
}

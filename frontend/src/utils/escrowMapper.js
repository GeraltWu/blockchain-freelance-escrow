// 后端 API 返回的 escrow(详情含 milestones)→ Dashboard 卡片所需结构
// 同时根据「当前地址是 client / freelancer / arbitrator」推导待处理事项(见 docs/ui-design.md 三.2)
export function mapEscrowToCard(escrow, myAddress) {
  const me = myAddress.toLowerCase()
  const role = escrow.client_address.toLowerCase() === me
    ? 'client'
    : escrow.freelancer_address.toLowerCase() === me
      ? 'freelancer'
      : 'arbitrator'
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
    // 卡片上展示的对方(们):client 看 freelancer,freelancer 看 client,arbitrator 看双方
    parties:
      role === 'arbitrator'
        ? [
            { label: 'Client', address: escrow.client_address },
            { label: 'Freelancer', address: escrow.freelancer_address },
          ]
        : [
            {
              label: role === 'client' ? 'Freelancer' : 'Client',
              address: role === 'client' ? escrow.freelancer_address : escrow.client_address,
            },
          ],
    totalWei: escrow.total_amount_wei,
    status: escrow.status,
    milestones,
    pendingLabel: derivePendingLabel(milestones, role),
  }
}

// 待处理推导:client 看 SUBMITTED(freelancer 已提交,等你确认),
// freelancer 看 PENDING(该提交了);arbitrator 看 DISPUTED(等你裁决),其余状态无操作
function derivePendingLabel(milestones, role) {
  if (role === 'client') {
    const m = milestones.find((x) => x.status === 'SUBMITTED')
    return m ? `M${m.index + 1} submitted — awaiting your approval` : null
  }
  if (role === 'freelancer') {
    const m = milestones.find((x) => x.status === 'PENDING')
    return m ? `M${m.index + 1} ready to submit` : null
  }
  const m = milestones.find((x) => x.status === 'DISPUTED')
  return m ? `M${m.index + 1} dispute — awaiting your decision` : null
}

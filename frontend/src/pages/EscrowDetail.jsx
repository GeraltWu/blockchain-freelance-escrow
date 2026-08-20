import { useParams } from 'react-router-dom'
import { ComingSoon } from '../components/ComingSoon.jsx'

// Page 3:Escrow Detail(见 docs/ui-design.md 五)
// TODO: 金额概览 + Milestone Timeline + 按角色/状态动态显示操作按钮
export function EscrowDetail() {
  const { escrowId } = useParams()
  return (
    <ComingSoon
      title={`Escrow #${escrowId} (in development)`}
      description="Escrow details + milestone Timeline + role/status-aware action buttons (Submit / Approve / Dispute)."
    />
  )
}

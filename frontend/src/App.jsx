import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout.jsx'
import { CreateEscrow } from './pages/CreateEscrow.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { EscrowDetail } from './pages/EscrowDetail.jsx'
import { TransactionHistory } from './pages/TransactionHistory.jsx'

// 路由入口(对应 docs/architecture.md 的四个 Page)
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateEscrow />} />
        <Route path="escrow/:escrowId" element={<EscrowDetail />} />
        <Route path="history" element={<TransactionHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

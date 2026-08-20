import { api } from './client.js'

// Escrow 模块接口(docs/api-spec.md 模块一)
export async function getEscrows(params) {
  const { data } = await api.get('/escrows', { params })
  return data // { total, page, page_size, items }
}

export async function getEscrowById(escrowId) {
  const { data } = await api.get(`/escrows/${escrowId}`)
  return data // 详情,含 milestones 数组
}

// 创建项目元数据:链上 createEscrow 交易确认后调用(见 docs/api-spec.md 1.3)
export async function createEscrowMetadata(payload) {
  const { data } = await api.post('/escrows', payload)
  return data // { escrow_id, status, created_at }
}

import { api } from './client.js'

// 交易历史(见 docs/api-spec.md 3.1)
// params: { address, escrow_id, action(逗号分隔多值), status, page, page_size }
export async function getTransactions(params) {
  const { data } = await api.get('/transactions', { params })
  return data // { total, page, page_size, items }
}

// 交易上报:链上交易确认后一次性上报(见 docs/api-spec.md 3.2)
// 后端会按 action 自动推导对应 milestone/escrow 的状态变化
export async function reportTransaction(payload) {
  const { data } = await api.post('/transactions', payload)
  return data // { tx_hash, status, block_number, created_at }
}

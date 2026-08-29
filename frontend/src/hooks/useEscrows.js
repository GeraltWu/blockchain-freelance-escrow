import { useCallback, useEffect, useState } from 'react'
import { getEscrowById, getEscrows } from '../api/escrows.js'
import { mapEscrowToCard } from '../utils/escrowMapper.js'

// 加载某个地址参与的全部 escrow(client/freelancer/arbitrator 三种身份,由 mapEscrowToCard 逐条推导):
// 列表 + 每条详情拿 milestones;数据只来自后端 API,失败时返回 error 由页面展示
export function useEscrows({ address }) {
  const [state, setState] = useState({ loading: true, error: null, escrows: [] })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 放在异步函数里,避免在 effect 主体同步 setState(react-hooks/set-state-in-effect)
      setState((s) => ({ ...s, loading: true }))
      try {
        const { items } = await getEscrows({ address, page_size: 50 })
        // allSettled:某一条详情失败不拖垮整个列表
        const details = await Promise.allSettled(
          items.map((item) => getEscrowById(item.escrow_id)),
        )
        const escrows = details
          .filter((r) => r.status === 'fulfilled')
          .map((r) => mapEscrowToCard(r.value, address))
        if (!cancelled) {
          setState({ loading: false, error: null, escrows })
        }
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err, escrows: [] })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [address, retryKey])

  const reload = useCallback(() => setRetryKey((k) => k + 1), [])
  return { ...state, reload }
}

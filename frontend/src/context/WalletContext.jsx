import { useCallback, useEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { WalletContext } from './wallet-context.js'
import {
  getAuthorizedAccounts,
  getBalanceWei,
  getChainId,
  hasWallet,
  onWalletEvents,
  requestAccounts,
  createProvider,
} from '../web3/wallet.js'
import { formatEth, shortenAddress } from '../utils/format.js'

// 全局钱包状态(对应 docs/architecture.md 的 context/WalletContext.jsx):
// status: disconnected | connecting | connected
// provider: 只读(view 调用/查余额);signer: 发交易用(调合约写方法时才需要)
const INITIAL_WALLET = {
  status: 'disconnected',
  address: null,
  chainId: null,
  balanceEth: null,
  provider: null,
  signer: null,
}

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(INITIAL_WALLET)

  // 事件回调注册一次,通过 ref 读取最新状态,避免闭包拿到过期值
  const walletRef = useRef(wallet)
  useEffect(() => {
    walletRef.current = wallet
  }, [wallet])

  // 拿到账户数组后落地状态:构造 provider/signer、读 chainId、查余额
  const applyAccounts = useCallback(async (accounts) => {
    if (!accounts || accounts.length === 0) {
      // 用户在 MetaMask 插件里断开了本站授权
      setWallet(INITIAL_WALLET)
      return
    }
    const address = accounts[0]
    try {
      const provider = createProvider()
      const signer = await provider.getSigner()
      const chainId = await getChainId()
      const balanceEth = formatEth(await getBalanceWei(provider, address))
      setWallet({ status: 'connected', address, chainId, balanceEth, provider, signer })
    } catch {
      // 读链信息失败(网络抖动等):保持之前的连接状态不动
    }
  }, [])

  // 发起连接:三种结果分别处理(用户同意 / 拒绝 / 已有 pending 请求)
  const connect = useCallback(async () => {
    if (walletRef.current.status !== 'disconnected') return
    setWallet((w) => ({ ...w, status: 'connecting' }))
    try {
      const accounts = await requestAccounts()
      await applyAccounts(accounts)
      notifications.show({
        title: 'Wallet connected',
        message: shortenAddress(accounts[0]),
        color: 'green',
      })
    } catch (err) {
      if (err?.code === 4001) {
        // 用户主动拒绝:不是系统错误,安静恢复即可
      } else if (err?.code === -32002) {
        notifications.show({
          title: 'Connection request already pending',
          message: 'Please check the MetaMask popup — a connection request is waiting there.',
          color: 'yellow',
        })
      } else {
        notifications.show({
          title: 'Connection failed',
          message: err?.message || 'Unknown error',
          color: 'red',
        })
      }
      setWallet((w) => ({ ...w, status: 'disconnected' }))
    }
  }, [applyAccounts])

  // 页面加载:静默恢复已授权账户(不弹窗),避免每次刷新都要重连
  useEffect(() => {
    if (!hasWallet()) return
    let cancelled = false
    ;(async () => {
      try {
        const accounts = await getAuthorizedAccounts()
        if (accounts.length > 0 && !cancelled) {
          await applyAccounts(accounts)
        }
      } catch {
        // 静默恢复失败(插件刚装/未授权):保持未连接,不打扰用户
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyAccounts])

  // 应用启动时注册一次账户/网络切换监听,卸载时移除
  useEffect(() => {
    if (!hasWallet()) return
    return onWalletEvents({
      onAccountsChanged: (accounts) => {
        applyAccounts(accounts)
      },
      onChainChanged: async () => {
        // 网络变了:provider/signer 绑定的是旧网络,必须重新构造
        const current = walletRef.current
        if (current.address) {
          await applyAccounts([current.address])
        }
      },
    })
  }, [applyAccounts])

  // 断开:MetaMask 没有程序化断开的方法,清空本地状态即可
  // 用户之后点 Connect 会重新走授权流程
  const disconnect = useCallback(() => {
    setWallet(INITIAL_WALLET)
  }, [])

  return (
    <WalletContext.Provider value={{ ...wallet, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

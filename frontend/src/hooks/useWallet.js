import { useContext } from 'react'
import { WalletContext } from '../context/wallet-context.js'

// 读取全局钱包状态(status/address/chainId/balanceEth/provider/signer + connect/disconnect)
// 单独文件避免和组件混出,保持 react-refresh 生效
export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}

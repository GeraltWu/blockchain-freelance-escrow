import { BrowserProvider } from 'ethers'

// 纯 web3 逻辑层(不依赖 React),对应 docs/architecture.md 的 web3/wallet.js:
// 检测钱包、发起连接、静默恢复、事件监听。状态管理在 context/WalletContext.jsx

// 目标网络:Sepolia(docs/architecture.md 七.1)
export const TARGET_CHAIN_ID = 11155111

// 常见网络 chainId → 名称(Header 网络徽章展示用)
export const CHAIN_NAMES = {
  1: 'Ethereum Mainnet',
  137: 'Polygon',
  17000: 'Holesky Testnet',
  11155111: 'Sepolia Testnet',
}

export function chainName(chainId) {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
}

// 检测是否装了 EIP-1193 兼容钱包插件(MetaMask 或同类)
export function hasWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum)
}

// 构造 Provider(只读:查余额、view 调用)。chainChanged 之后必须重新构造
export function createProvider() {
  return new BrowserProvider(window.ethereum)
}

// 发起连接:弹出 MetaMask 授权窗口,返回授权账户数组
// 错误码:4001 用户拒绝;-32002 已有待处理的连接请求(MetaMask RPC 文档)
export function requestAccounts() {
  return createProvider().send('eth_requestAccounts', [])
}

// 静默获取已授权账户(不弹窗):页面刷新后靠它恢复连接状态
export function getAuthorizedAccounts() {
  return createProvider().send('eth_accounts', [])
}

// 当前网络 chainId(十进制整数)
export async function getChainId() {
  const hex = await createProvider().send('eth_chainId', [])
  return Number(hex)
}

// 查询余额,返回 wei 字符串(金额一律 wei 字符串,见 docs/data-model.md 三)
export async function getBalanceWei(provider, address) {
  return (await provider.getBalance(address)).toString()
}

// 注册账户/网络切换监听,返回取消函数(组件卸载时调用,避免内存泄漏)
export function onWalletEvents({ onAccountsChanged, onChainChanged }) {
  const { ethereum } = window
  ethereum.on('accountsChanged', onAccountsChanged)
  ethereum.on('chainChanged', onChainChanged)
  return () => {
    ethereum.removeListener('accountsChanged', onAccountsChanged)
    ethereum.removeListener('chainChanged', onChainChanged)
  }
}

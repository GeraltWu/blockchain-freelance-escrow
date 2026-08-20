import { createContext } from 'react'

// 钱包 Context 对象单独一个文件(react-refresh 要求 context 不与组件混出)
// 值结构见 WalletContext.jsx 的 Provider
export const WalletContext = createContext(null)

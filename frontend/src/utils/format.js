import { formatEther } from 'ethers'

// 地址缩写:0x1234...5678,全站统一规则,见 docs/ui-design.md「七、跨页面的交互细节」
export function shortenAddress(address, head = 6, tail = 4) {
  if (!address) return ''
  return `${address.slice(0, head)}...${address.slice(-tail)}`
}

// wei 字符串 → 可读 ETH 字符串,最多保留 maxDecimals 位小数并去掉末尾的 0
// 金额一律用 wei 字符串传递,不做浮点运算,见 docs/data-model.md「三、字段命名与类型约定」
export function formatEth(wei, maxDecimals = 4) {
  const eth = formatEther(BigInt(wei))
  const [int, dec] = eth.split('.')
  if (!dec || maxDecimals <= 0) return int
  const trimmed = dec.slice(0, maxDecimals).replace(/0+$/, '')
  return trimmed ? `${int}.${trimmed}` : int
}

// 已释放金额 = 所有 RELEASED 状态的 milestone 金额之和(单位 wei)
export function getReleasedWei(milestones) {
  return milestones
    .reduce((sum, m) => (m.status === 'RELEASED' ? sum + BigInt(m.amountWei) : sum), 0n)
    .toString()
}

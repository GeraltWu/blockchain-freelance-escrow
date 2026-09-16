import { ActionIcon, Anchor, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCopy } from '@tabler/icons-react'
import { Mono } from './Mono.jsx'
import { shortenAddress } from '../utils/format.js'
import { useWallet } from '../hooks/useWallet.js'
import { blockExplorerUrl } from '../web3/wallet.js'

// 地址缩写 + 复制图标,全站统一规则(见 docs/ui-design.md「七、跨页面的交互细节」)
// 点击地址文字新标签页打开区块浏览器;复制图标只复制不触发外层跳转
export function AddressText({ address, size = 'sm' }) {
  const { chainId } = useWallet()
  const copy = async (e) => {
    e?.stopPropagation() // 在可点击容器(如 EscrowCard)内时不触发外层跳转
    try {
      await navigator.clipboard.writeText(address)
      notifications.show({ message: 'Address copied', color: 'green' })
    } catch {
      // 剪贴板不可用(非 https 环境等)时静默失败
    }
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Anchor
        href={`${blockExplorerUrl(chainId)}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        c="dimmed"
        underline="hover"
        size={size}
        onClick={(e) => e.stopPropagation()}
      >
        <Mono inherit title={address}>
          {shortenAddress(address)}
        </Mono>
      </Anchor>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="xs"
        onClick={copy}
        aria-label="Copy full address"
      >
        <IconCopy size={12} stroke={1.5} />
      </ActionIcon>
    </Group>
  )
}

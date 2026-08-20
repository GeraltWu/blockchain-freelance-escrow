import { ActionIcon, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCopy } from '@tabler/icons-react'
import { Mono } from './Mono.jsx'
import { shortenAddress } from '../utils/format.js'

// 地址缩写 + 复制图标,全站统一规则(见 docs/ui-design.md「七、跨页面的交互细节」)
export function AddressText({ address, size = 'sm' }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      notifications.show({ message: 'Address copied', color: 'green' })
    } catch {
      // 剪贴板不可用(非 https 环境等)时静默失败
    }
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Mono size={size} c="dimmed" title={address}>
        {shortenAddress(address)}
      </Mono>
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

import { Badge, Burger, Group, Text, ThemeIcon } from '@mantine/core'
import { IconShieldLock } from '@tabler/icons-react'
import { ColorSchemeToggle } from '../ColorSchemeToggle.jsx'
import { WalletButton } from '../WalletButton.jsx'
import { useWallet } from '../../hooks/useWallet.js'
import { chainName, TARGET_CHAIN_ID } from '../../web3/wallet.js'

// 顶部栏:Logo + 网络标识(纯展示)+ 深浅色切换 + Wallet 按钮
// 见 docs/ui-design.md「二、整体布局结构 - Header」
function NetworkBadge() {
  const { chainId } = useWallet()
  // 已连接:显示钱包实际所在网络;未连接:显示目标网络。
  // 纯展示,不做主动校验/切换提示(网络不对时由交易失败的提示兜底,见 ui-design.md 七)
  const name = chainId ? chainName(chainId) : chainName(TARGET_CHAIN_ID)
  return (
    <Badge
      variant="light"
      color="gray"
      size="sm"
      leftSection={<span className={chainId ? 'network-dot' : 'network-dot network-dot-offline'} />}
      visibleFrom="xs"
    >
      {name}
    </Badge>
  )
}

export function HeaderBar({ opened, onToggle }) {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <Burger opened={opened} onClick={onToggle} hiddenFrom="sm" size="sm" />
        <ThemeIcon variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size={32} radius="md">
          <IconShieldLock size={18} stroke={1.5} />
        </ThemeIcon>
        <Text fw={700} size="lg" visibleFrom="xs">
          Freelance Escrow
        </Text>
        <NetworkBadge />
      </Group>

      <Group gap="xs" wrap="nowrap">
        <ColorSchemeToggle />
        <WalletButton />
      </Group>
    </Group>
  )
}

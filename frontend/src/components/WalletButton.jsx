import { Button, Group, Menu, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconDownload, IconExternalLink, IconLogout, IconWallet } from '@tabler/icons-react'
import { useWallet } from '../hooks/useWallet.js'
import { hasWallet } from '../web3/wallet.js'
import { shortenAddress } from '../utils/format.js'
import { Mono } from './Mono.jsx'

// 全站最重要的常驻组件:未连接 / 连接中 / 已连接 三种状态
// (见 docs/ui-design.md「二、整体布局结构 - Header」)
// 连接逻辑见 context/WalletContext.jsx,真实 MetaMask 授权流程

// 按当前所在网络跳对应的区块浏览器
function explorerUrl(chainId) {
  return chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'
}

function InstallWalletModal({ opened, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Wallet plugin not detected" centered>
      <Stack gap="sm">
        <Text size="sm">
          No EIP-1193 compatible wallet (such as MetaMask) was detected in this browser.
          Install MetaMask, then refresh the page to connect.
        </Text>
        <Button
          component="a"
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          leftSection={<IconDownload size={16} stroke={1.5} />}
        >
          Install MetaMask
        </Button>
      </Stack>
    </Modal>
  )
}

export function WalletButton() {
  const { status, address, chainId, balanceEth, connect, disconnect } = useWallet()
  const [installOpened, { open: openInstall, close: closeInstall }] = useDisclosure(false)

  // 未装插件:不发连接请求,直接提示安装(见需求第 1 步「检测钱包」)
  const handleConnect = () => {
    if (!hasWallet()) {
      openInstall()
      return
    }
    connect()
  }

  // 连接中:loading 状态
  if (status === 'connecting') {
    return <Button loading>Connecting…</Button>
  }

  // 未连接:纯色填充,醒目
  if (status !== 'connected' || !address) {
    return (
      <>
        <Button leftSection={<IconWallet size={18} stroke={1.5} />} onClick={handleConnect}>
          Connect Wallet
        </Button>
        <InstallWalletModal opened={installOpened} onClose={closeInstall} />
      </>
    )
  }

  // 已连接:缩写地址 + 余额,点击弹出下拉菜单
  return (
    <Menu position="bottom-end" withArrow shadow="md" width={240}>
      <Menu.Target>
        <Button variant="light" leftSection={<IconWallet size={18} stroke={1.5} />}>
          <Group gap={6} wrap="nowrap">
            <Mono inherit>{shortenAddress(address)}</Mono>
            {balanceEth && (
              <Mono inherit c="dimmed">
                {balanceEth} ETH
              </Mono>
            )}
          </Group>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          {/* 完整地址较长,允许在菜单宽度内折行,避免溢出 */}
          <Mono inherit size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
            {address}
          </Mono>
        </Menu.Label>
        <Menu.Item
          component="a"
          href={`${explorerUrl(chainId)}/address/${address}`}
          target="_blank"
          rel="noreferrer"
          leftSection={<IconExternalLink size={14} stroke={1.5} />}
        >
          View on block explorer
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={14} stroke={1.5} />}
          onClick={disconnect}
        >
          Disconnect
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

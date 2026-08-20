import {
  Alert,
  Button,
  Center,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBriefcase,
  IconCircleCheck,
  IconInbox,
  IconLock,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react'
import { EscrowCard } from '../components/EscrowCard.jsx'
import { Mono } from '../components/Mono.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { useEscrows } from '../hooks/useEscrows.js'
import { useWallet } from '../hooks/useWallet.js'
import { formatEth, getReleasedWei, shortenAddress } from '../utils/format.js'

// 首页 Dashboard(见 docs/ui-design.md「三、Page 1:Dashboard」):
// 统计卡片 → 角色切换 → 项目列表 → 空状态
// 数据只来自后端 GET /api/escrows(+ 详情拿 milestones),后端不可用时显示错误提示

// TODO: 接入真实 MetaMask 后,替换为当前连接的钱包地址(见 docs/architecture.md web3/wallet.js)
// 后端种子数据围绕这个地址,保证钱包接入前页面有真实的 API 数据可看
const DEMO_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

function EmptyState() {
  return (
    <Center py={64}>
      <Stack align="center" gap="xs" maw={360}>
        <ThemeIcon variant="light" color="gray" size={64} radius="xl">
          <IconInbox size={32} stroke={1.25} />
        </ThemeIcon>
        <Title order={4} ta="center">
          No active projects yet
        </Title>
        <Text size="sm" c="dimmed" ta="center">
          Start an escrow as a client — funds are held by the smart contract and released
          milestone by milestone.
        </Text>
        <Button component={Link} to="/create" leftSection={<IconPlus size={16} stroke={1.5} />} mt="sm">
          Create Escrow
        </Button>
      </Stack>
    </Center>
  )
}

function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={96} />
        ))}
      </SimpleGrid>
      <Skeleton height={40} width={320} />
      <Skeleton height={140} />
      <Skeleton height={140} />
    </Stack>
  )
}

export function Dashboard() {
  // 同一个钱包既是某些项目的 Client,也是另一些项目的 Freelancer,两种视角分开看
  const [role, setRole] = useState('client') // client | freelancer

  // 已连接:用真实钱包地址;未连接:退回演示地址(后端种子数据围绕它)
  const { address: walletAddress } = useWallet()
  const address = walletAddress ?? DEMO_ADDRESS

  const { loading, error, escrows, reload } = useEscrows({ address })
  const clientEscrows = escrows.filter((e) => e.role === 'client')
  const freelancerEscrows = escrows.filter((e) => e.role === 'freelancer')
  const myEscrows = role === 'client' ? clientEscrows : freelancerEscrows

  if (loading) {
    return <DashboardSkeleton />
  }

  // 统计指标(随角色切换重新计算)
  const active = myEscrows.filter((e) => e.status === 'CREATED' || e.status === 'FUNDED')
  const lockedWei = active.reduce(
    (sum, e) => sum + BigInt(e.totalWei) - BigInt(getReleasedWei(e.milestones)),
    0n,
  )
  const pendingCount = myEscrows.filter((e) => e.pendingLabel).length
  const completedCount = myEscrows.filter((e) => e.status === 'COMPLETED').length

  const stats = [
    { icon: IconBriefcase, label: 'Active Projects', value: String(active.length) },
    { icon: IconLock, label: 'Total Locked Funds', value: formatEth(lockedWei.toString()), unit: 'ETH' },
    { icon: IconAlertCircle, label: 'Pending Actions', value: String(pendingCount) },
    { icon: IconCircleCheck, label: 'Completed Projects', value: String(completedCount) },
  ]

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text size="sm" c="dimmed" mt={4}>
          An overview of your escrow projects — see at a glance which ones need your action.
        </Text>
        {!walletAddress && (
          <Text size="xs" c="dimmed" mt={2}>
            Demo mode: showing data for <Mono inherit>{shortenAddress(DEMO_ADDRESS)}</Mono> —
            connect your wallet to see your own escrows.
          </Text>
        )}
      </div>

      {error && (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconAlertTriangle size={18} stroke={1.5} />}
          title="Cannot reach the backend API"
        >
          <Text size="sm">
            {error.message || 'Unknown error'} — make sure the Flask backend is running
            (<code>cd backend && python run.py</code>).
          </Text>
          <Button
            variant="light"
            color="yellow"
            size="xs"
            leftSection={<IconRefresh size={14} stroke={1.5} />}
            onClick={reload}
            mt="sm"
          >
            Retry
          </Button>
        </Alert>
      )}

      {!error && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </SimpleGrid>

          <SegmentedControl
            value={role}
            onChange={setRole}
            data={[
              { value: 'client', label: `As Client · ${clientEscrows.length}` },
              { value: 'freelancer', label: `As Freelancer · ${freelancerEscrows.length}` },
            ]}
          />

          {myEscrows.length === 0 ? (
            <EmptyState />
          ) : (
            <Stack gap="md">
              {myEscrows.map((e) => (
                <EscrowCard key={e.escrow_id} escrow={e} />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  )
}

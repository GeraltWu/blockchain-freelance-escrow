import {
  Alert,
  Button,
  Center,
  Group,
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
import { ConnectPrompt } from '../components/ConnectPrompt.jsx'
import { EscrowCard } from '../components/EscrowCard.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { useEscrows } from '../hooks/useEscrows.js'
import { useWallet } from '../hooks/useWallet.js'
import { formatEth, getReleasedWei } from '../utils/format.js'

// 首页 Dashboard(见 docs/ui-design.md「三、Page 1:Dashboard」):
// 统计卡片 → 角色切换 → 项目列表 → 空状态
// 数据只来自后端 GET /api/escrows(+ 详情拿 milestones),按当前钱包地址过滤;
// 未连接钱包时提示连接

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
  const { address } = useWallet()

  // 未连接钱包:无从按地址过滤,提示连接
  if (!address) {
    return (
      <Stack gap="lg">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text size="sm" c="dimmed" mt={4}>
            An overview of your escrow projects — see at a glance which ones need your action.
          </Text>
        </div>
        <ConnectPrompt description="Connect MetaMask (Sepolia) to see your escrows — as client, freelancer, or both." />
      </Stack>
    )
  }

  // key=address:切换账户时数据区整体重挂载,状态清零,避免旧账户数据残留
  return <DashboardContent key={address} address={address} />
}

function DashboardContent({ address }) {
  // 同一个钱包既是某些项目的 Client,也是另一些项目的 Freelancer,两种视角分开看
  const [role, setRole] = useState('client') // client | freelancer

  const { loading, error, escrows, reload } = useEscrows({ address })
  const clientEscrows = escrows.filter((e) => e.role === 'client')
  const freelancerEscrows = escrows.filter((e) => e.role === 'freelancer')
  const myEscrows = role === 'client' ? clientEscrows : freelancerEscrows

  if (loading) {
    return <DashboardSkeleton />
  }

  // 统计指标:随角色切换重新计算,指标名自带角色语义(方案 A)
  const active = myEscrows.filter((e) => e.status === 'CREATED' || e.status === 'FUNDED')
  const lockedWei = active.reduce(
    (sum, e) => sum + BigInt(e.totalWei) - BigInt(getReleasedWei(e.milestones)),
    0n,
  )
  // pendingLabel 由 mapper 按角色推导:client=有 SUBMITTED 待确认,freelancer=有 PENDING 待提交
  const pendingCount = myEscrows.filter((e) => e.pendingLabel).length
  const completedCount = myEscrows.filter((e) => e.status === 'COMPLETED').length

  const commonStats = [
    { icon: IconBriefcase, label: 'Active Projects', value: String(active.length) },
    { icon: IconCircleCheck, label: 'Completed Projects', value: String(completedCount) },
  ]
  const roleStats =
    role === 'client'
      ? [
          { icon: IconLock, label: 'Total Locked Funds', value: formatEth(lockedWei.toString()), unit: 'ETH' },
          { icon: IconAlertCircle, label: 'Awaiting Your Approval', value: String(pendingCount) },
        ]
      : [
          { icon: IconLock, label: 'Funds in Escrow', value: formatEth(lockedWei.toString()), unit: 'ETH' },
          { icon: IconAlertCircle, label: 'Ready to Submit', value: String(pendingCount) },
        ]
  const stats = [commonStats[0], ...roleStats, commonStats[1]]

  return (
    <Stack gap="lg">
      {/* 角色切换紧跟标题、位于统计卡之上:先选身份 → 再看数据(方案 A) */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text size="sm" c="dimmed" mt={4}>
            An overview of your escrow projects — see at a glance which ones need your action.
          </Text>
        </div>
        <SegmentedControl
          value={role}
          onChange={setRole}
          data={[
            { value: 'client', label: `As Client · ${clientEscrows.length}` },
            { value: 'freelancer', label: `As Freelancer · ${freelancerEscrows.length}` },
          ]}
        />
      </Group>

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

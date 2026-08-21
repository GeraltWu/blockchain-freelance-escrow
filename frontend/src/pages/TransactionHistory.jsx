import {
  ActionIcon,
  Anchor,
  Button,
  Center,
  Group,
  MultiSelect,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCashBanknote,
  IconChevronDown,
  IconFilePlus,
  IconGavel,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import { getEscrows } from '../api/escrows.js'
import { getTransactions } from '../api/transactions.js'
import { AddressText } from '../components/AddressText.jsx'
import { ConnectPrompt } from '../components/ConnectPrompt.jsx'
import { Mono } from '../components/Mono.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { useWallet } from '../hooks/useWallet.js'
import { formatEth, shortenAddress } from '../utils/format.js'

// Page 4:Transaction History(见 docs/ui-design.md 六)
// 审计视角:时间倒序的交易列表 + 筛选栏 + 可展开详情行 + 分页
// Tx Hash 直接跳 Sepolia 区块浏览器

// action → 图标 + 文案(放款 ↗ / 退款 ↙,见 ui-design.md 六.2)
const ACTION_META = {
  CREATE_ESCROW: { label: 'Create Escrow', icon: IconFilePlus },
  FUND_ESCROW: { label: 'Fund Escrow', icon: IconCashBanknote },
  SUBMIT_MILESTONE: { label: 'Submit Milestone', icon: IconSend },
  APPROVE_MILESTONE: { label: 'Approve Milestone', icon: IconArrowUpRight },
  RAISE_DISPUTE: { label: 'Raise Dispute', icon: IconAlertTriangle },
  RESOLVE_DISPUTE: { label: 'Resolve Dispute', icon: IconGavel },
  REFUND: { label: 'Refund', icon: IconArrowDownLeft },
}

const PAGE_SIZE = 20

export function TransactionHistory() {
  const { address } = useWallet()
  const [searchParams] = useSearchParams()

  if (!address) {
    return (
      <Stack gap="lg">
        <div>
          <Title order={2}>Transaction History</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Every on-chain transaction you initiated, newest first.
          </Text>
        </div>
        <ConnectPrompt description="Connect MetaMask (Sepolia) to see your transaction history." />
      </Stack>
    )
  }

  // key=address:切换账户时整块重挂载,状态清零
  return <HistoryContent key={address} address={address} initialEscrow={searchParams.get('escrow')} />
}

function HistoryContent({ address, initialEscrow }) {
  const [escrowFilter, setEscrowFilter] = useState(initialEscrow ?? '') // '' = All Projects
  const [actionFilter, setActionFilter] = useState([]) // 空数组 = All Actions
  const [statusFilter, setStatusFilter] = useState('') // '' = All Statuses
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(() => new Set())
  const [escrowOptions, setEscrowOptions] = useState([])
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [reloadKey, setReloadKey] = useState(0)

  // 项目下拉选项:我参与的 escrow
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { items } = await getEscrows({ address, page_size: 50 })
        if (!cancelled) {
          setEscrowOptions(
            items.map((e) => ({ value: String(e.escrow_id), label: `#${e.escrow_id} · ${e.title}` })),
          )
        }
      } catch {
        // 下拉选项拉不到不阻塞页面主体
      }
    })()
    return () => {
      cancelled = true
    }
  }, [address])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState((s) => ({ ...s, loading: true }))
      try {
        const data = await getTransactions({
          address,
          escrow_id: escrowFilter ? Number(escrowFilter) : undefined,
          action: actionFilter.length ? actionFilter.join(',') : undefined,
          status: statusFilter || undefined,
          page,
          page_size: PAGE_SIZE,
        })
        if (!cancelled) setState({ loading: false, error: null, data })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err, data: null })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [address, escrowFilter, actionFilter, statusFilter, page, reloadKey])

  // 改筛选时回到第一页
  const changeEscrow = (v) => { setEscrowFilter(v ?? ''); setPage(1) }
  const changeAction = (v) => { setActionFilter(v); setPage(1) }
  const changeStatus = (v) => { setStatusFilter(v ?? ''); setPage(1) }

  const toggleExpand = (txHash) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(txHash)) next.delete(txHash)
      else next.add(txHash)
      return next
    })
  }

  const { loading, error, data } = state

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Transaction History</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Every on-chain transaction you initiated, newest first.
        </Text>
      </div>

      {/* 筛选栏(ui-design.md 六.1) */}
      <Group gap="sm" wrap="wrap">
        <Select
          data={[{ value: '', label: 'All Projects' }, ...escrowOptions]}
          value={escrowFilter}
          onChange={changeEscrow}
          w={240}
          searchable
          clearable
        />
        <MultiSelect
          data={Object.entries(ACTION_META).map(([value, { label }]) => ({ value, label }))}
          value={actionFilter}
          onChange={changeAction}
          placeholder="All Actions"
          w={280}
          clearable
        />
        <Select
          data={[
            { value: '', label: 'All Statuses' },
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'FAILED', label: 'Failed' },
            { value: 'PENDING', label: 'Pending' },
          ]}
          value={statusFilter}
          onChange={changeStatus}
          w={160}
        />
        <ActionIcon variant="default" size="lg" aria-label="Refresh" onClick={() => setReloadKey((k) => k + 1)}>
          <IconRefresh size={16} stroke={1.5} />
        </ActionIcon>
        {data && (
          <Text size="sm" c="dimmed" ml="auto">
            {data.total} transaction{data.total === 1 ? '' : 's'}
          </Text>
        )}
      </Group>

      {loading ? (
        <Stack gap="sm">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}
        </Stack>
      ) : error ? (
        <Center py={48}>
          <Stack align="center" gap="sm">
            <Text size="sm" c="red">{error.message || 'Failed to load transactions'}</Text>
            <Button variant="light" leftSection={<IconRefresh size={14} stroke={1.5} />} onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </Stack>
        </Center>
      ) : !data || data.items.length === 0 ? (
        <Center py={48}>
          <Text size="sm" c="dimmed">No transactions found with the current filters.</Text>
        </Center>
      ) : (
        <>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40} />
                <Table.Th>Time</Table.Th>
                <Table.Th>Project</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tx Hash</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((t) => {
                const meta = ACTION_META[t.action] ?? { label: t.action, icon: IconFilePlus }
                const ActionIconComp = meta.icon
                const isExpanded = expanded.has(t.tx_hash)
                return [
                  <Table.Tr key={t.tx_hash}>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Toggle details"
                        onClick={() => toggleExpand(t.tx_hash)}
                      >
                        <IconChevronDown
                          size={14}
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                        />
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td><Text size="sm" style={{ whiteSpace: 'nowrap' }}>{dayjs(t.created_at).format('YYYY-MM-DD HH:mm')}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} maw={220}>
                        {t.escrow_title ? `#${t.escrow_id} ${t.escrow_title}` : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <ActionIconComp size={14} stroke={1.5} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{meta.label}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Mono size="sm">{t.amount_wei ? `${formatEth(t.amount_wei)} ETH` : '—'}</Mono>
                    </Table.Td>
                    <Table.Td><StatusBadge status={t.status} /></Table.Td>
                    <Table.Td>
                      <Anchor href={`https://sepolia.etherscan.io/tx/${t.tx_hash}`} target="_blank" rel="noreferrer" size="sm">
                        <Mono inherit c="blue">{shortenAddress(t.tx_hash)}</Mono>
                      </Anchor>
                    </Table.Td>
                  </Table.Tr>,
                  isExpanded && (
                    <Table.Tr key={`${t.tx_hash}-details`}>
                      <Table.Td colSpan={7}>
                        <Group gap="xl" py="xs" px="md" wrap="wrap">
                          <div>
                            <Text size="xs" c="dimmed">From</Text>
                            <AddressText address={t.from_address} />
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">Escrow</Text>
                            <Text size="sm">{t.escrow_id != null ? `#${t.escrow_id}` : '—'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">Milestone</Text>
                            <Text size="sm">{t.milestone_index != null ? `M${t.milestone_index + 1}` : '—'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">Block</Text>
                            {t.block_number != null ? (
                              <Anchor href={`https://sepolia.etherscan.io/block/${t.block_number}`} target="_blank" rel="noreferrer" size="sm">
                                <Mono inherit c="blue">{t.block_number}</Mono>
                              </Anchor>
                            ) : (
                              <Text size="sm">—</Text>
                            )}
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">Confirmed at</Text>
                            <Text size="sm">{t.confirmed_at ? dayjs(t.confirmed_at).format('YYYY-MM-DD HH:mm') : '—'}</Text>
                          </div>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ),
                ]
              })}
            </Table.Tbody>
          </Table>

          {data.total > PAGE_SIZE && (
            <Group justify="center">
              <Pagination value={page} onChange={setPage} total={Math.ceil(data.total / PAGE_SIZE)} />
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}

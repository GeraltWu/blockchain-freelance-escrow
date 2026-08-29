import {
  Alert,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconCircleCheck,
  IconGavel,
  IconReceiptRefund,
  IconRefresh,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import { getEscrowById } from '../api/escrows.js'
import { reportTransaction } from '../api/transactions.js'
import { AddressText } from '../components/AddressText.jsx'
import { Mono } from '../components/Mono.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { useWallet } from '../hooks/useWallet.js'
import { formatEth, getReleasedWei, shortenAddress } from '../utils/format.js'
import { STATUS_COLORS } from '../utils/statusColors.js'
import {
  approveMilestoneOnChain,
  fundEscrowOnChain,
  raiseDisputeOnChain,
  refundOnChain,
  resolveDisputeOnChain,
  submitMilestoneOnChain,
  txErrorMessage,
} from '../web3/contract.js'

// Page 3:Escrow Detail(见 docs/ui-design.md 五)
// 同一个页面,根据连接钱包的角色(client/freelancer/arbitrator)+ milestone 状态动态显示操作按钮。
// 每个链上操作:三段式通知 → 交易确认后 POST /api/transactions 上报
// (后端自动推导 milestone/escrow 状态,api-spec 3.2)→ 重新拉取数据

export function EscrowDetail() {
  const { escrowId } = useParams()
  const id = Number(escrowId)
  const { address, signer } = useWallet()

  const [escrow, setEscrow] = useState(null)
  const [loadState, setLoadState] = useState('loading') // loading | ok | not-found | error
  const [actionBusy, setActionBusy] = useState(null) // 进行中的操作 id,如 'submit-0'
  const [confirm, setConfirm] = useState(null) // { type, milestoneIndex }
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadState('loading')
      try {
        const data = await getEscrowById(id)
        if (cancelled) return
        // 后端里程碑金额字段是 amount_wei(snake_case),
        // 工具函数(如 getReleasedWei)按 camelCase 的 amountWei 读取,这里在边界补上
        const milestones = (data.milestones || []).map((m) => ({ ...m, amountWei: m.amount_wei }))
        setEscrow({ ...data, milestones })
        setLoadState('ok')
      } catch (err) {
        if (!cancelled) {
          setLoadState(err?.response?.status === 404 ? 'not-found' : 'error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  // 重试 / 操作完成后刷新:改 key 触发上面的 effect 重新拉取
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // ---- 派生状态 ----
  const myAddress = address?.toLowerCase() ?? null
  const role = escrow && myAddress
    ? escrow.client_address.toLowerCase() === myAddress
      ? 'client'
      : escrow.freelancer_address.toLowerCase() === myAddress
        ? 'freelancer'
        : null
    : null
  // 仲裁者逐项目不同:与「该项目」的 arbitrator_address 比较,而不是全局合约变量(api-spec 4.6)
  const isArbitrator = Boolean(
    escrow?.arbitrator_address && myAddress === escrow.arbitrator_address.toLowerCase(),
  )
  const counterparty = escrow
    ? role === 'client' ? escrow.freelancer_address : escrow.client_address
    : null

  const releasedWei = escrow ? getReleasedWei(escrow.milestones) : '0'
  const lockedWei = escrow
    ? (BigInt(escrow.total_amount_wei) - BigInt(releasedWei)).toString()
    : '0'
  const releasedPct = escrow && escrow.total_amount_wei !== '0'
    ? Number((BigInt(releasedWei) * 10000n) / BigInt(escrow.total_amount_wei)) / 100
    : 0

  const deadline = escrow?.deadline ? dayjs(escrow.deadline) : null
  const daysDiff = deadline ? deadline.diff(dayjs(), 'day') : 0
  const deadlineText = deadline
    ? daysDiff > 0 ? `${daysDiff} days left` : daysDiff === 0 ? 'Due today' : `${-daysDiff} days overdue`
    : null
  const deadlineColor = !deadline ? 'dimmed' : daysDiff <= 0 ? 'red' : daysDiff <= 7 ? 'orange' : 'dimmed'
  const isOverdue = daysDiff < 0

  const confirmMilestone = confirm
    ? escrow?.milestones.find((m) => m.milestone_index === confirm.milestoneIndex)
    : null

  // ---- 链上操作统一流程:通知 → 发交易 → 上报 → 刷新 ----
  const runAction = useCallback(async ({ notifyId, chainCall, report, successTitle }) => {
    if (!signer || !address) return
    setActionBusy(notifyId)
    notifications.show({
      id: notifyId,
      title: 'Waiting for wallet confirmation…',
      message: 'Confirm the transaction in MetaMask.',
      color: 'blue',
      loading: true,
      autoClose: false,
    })
    try {
      const { txHash, blockNumber } = await chainCall({
        signer,
        onSubmitted: (hash) => {
          notifications.update({
            id: notifyId,
            title: 'Transaction submitted',
            message: `Waiting for on-chain confirmation… ${shortenAddress(hash)}`,
            color: 'blue',
            loading: true,
            autoClose: false,
          })
        },
      })
      await reportTransaction({
        tx_hash: txHash,
        from_address: address,
        status: 'CONFIRMED',
        block_number: blockNumber,
        ...report,
      })
      notifications.update({
        id: notifyId,
        title: successTitle,
        message: 'On-chain state updated.',
        color: 'green',
        loading: false,
        autoClose: 5000,
      })
      setConfirm(null)
      await reload()
    } catch (err) {
      if (err?.code === 4001) {
        notifications.update({
          id: notifyId,
          title: 'Cancelled',
          message: 'You rejected the transaction in MetaMask.',
          color: 'gray',
          loading: false,
          autoClose: 4000,
        })
      } else {
        notifications.update({
          id: notifyId,
          title: 'Transaction failed',
          message: txErrorMessage(err),
          color: 'red',
          loading: false,
          autoClose: 7000,
        })
      }
    } finally {
      setActionBusy(null)
    }
  }, [signer, address, reload])

  const fundEscrow = () => runAction({
    notifyId: 'fund',
    chainCall: (opts) => fundEscrowOnChain({ ...opts, escrowId: id, amountWei: escrow.total_amount_wei }),
    report: { escrow_id: id, action: 'FUND_ESCROW', amount_wei: escrow.total_amount_wei },
    successTitle: 'Escrow funded',
  })
  const submitMilestone = (m) => runAction({
    notifyId: `submit-${m.milestone_index}`,
    chainCall: (opts) => submitMilestoneOnChain({ ...opts, escrowId: id, milestoneIndex: m.milestone_index }),
    report: { escrow_id: id, milestone_index: m.milestone_index, action: 'SUBMIT_MILESTONE' },
    successTitle: `M${m.milestone_index + 1} submitted`,
  })
  const approveMilestone = (m) => runAction({
    notifyId: `approve-${m.milestone_index}`,
    chainCall: (opts) => approveMilestoneOnChain({ ...opts, escrowId: id, milestoneIndex: m.milestone_index }),
    report: { escrow_id: id, milestone_index: m.milestone_index, action: 'APPROVE_MILESTONE', amount_wei: m.amount_wei },
    successTitle: `M${m.milestone_index + 1} approved — ${formatEth(m.amount_wei)} ETH released`,
  })
  const raiseDispute = (m) => runAction({
    notifyId: `dispute-${m.milestone_index}`,
    chainCall: (opts) => raiseDisputeOnChain({ ...opts, escrowId: id, milestoneIndex: m.milestone_index }),
    report: { escrow_id: id, milestone_index: m.milestone_index, action: 'RAISE_DISPUTE' },
    successTitle: `Dispute raised on M${m.milestone_index + 1}`,
  })
  const resolveDispute = (m, toFreelancer) => runAction({
    notifyId: `resolve-${m.milestone_index}`,
    chainCall: (opts) => resolveDisputeOnChain({ ...opts, escrowId: id, milestoneIndex: m.milestone_index, releaseToFreelancer: toFreelancer }),
    report: {
      escrow_id: id,
      milestone_index: m.milestone_index,
      action: 'RESOLVE_DISPUTE',
      resolve_to_freelancer: toFreelancer,
      amount_wei: toFreelancer ? m.amount_wei : undefined,
    },
    successTitle: toFreelancer
      ? `Released ${formatEth(m.amount_wei)} ETH to freelancer`
      : `Refunded ${formatEth(m.amount_wei)} ETH to client`,
  })
  const refundMilestone = (m) => runAction({
    notifyId: `refund-${m.milestone_index}`,
    chainCall: (opts) => refundOnChain({ ...opts, escrowId: id, milestoneIndex: m.milestone_index }),
    report: { escrow_id: id, milestone_index: m.milestone_index, action: 'REFUND', amount_wei: m.amount_wei },
    successTitle: `M${m.milestone_index + 1} refunded`,
  })

  // ---- 每个 milestone 右侧的操作区(按角色 + 状态动态显示,ui-design.md 五.3) ----
  const milestoneActions = (m) => {
    const busy = actionBusy === `submit-${m.milestone_index}`
      || actionBusy === `approve-${m.milestone_index}`
      || actionBusy === `dispute-${m.milestone_index}`
      || actionBusy === `refund-${m.milestone_index}`
      || actionBusy === `resolve-${m.milestone_index}`

    if (m.status === 'RELEASED') {
      return (
        <Group gap={6}>
          <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
          <Text size="xs" c="dimmed">
            Released {m.approved_at ? dayjs(m.approved_at).format('YYYY-MM-DD HH:mm') : ''}
          </Text>
        </Group>
      )
    }
    if (m.status === 'REFUNDED') {
      return (
        <Group gap={6}>
          <IconReceiptRefund size={14} color="var(--mantine-color-gray-6)" />
          <Text size="xs" c="dimmed">
            Refunded {m.approved_at ? dayjs(m.approved_at).format('YYYY-MM-DD HH:mm') : ''}
          </Text>
        </Group>
      )
    }
    if (m.status === 'DISPUTED') {
      if (isArbitrator) {
        return (
          <Button
            color="orange"
            size="xs"
            leftSection={<IconGavel size={14} stroke={1.5} />}
            loading={busy}
            disabled={!signer}
            onClick={() => setConfirm({ type: 'resolve', milestoneIndex: m.milestone_index })}
          >
            Resolve
          </Button>
        )
      }
      return <Text size="xs" c="dimmed">Disputed — awaiting arbitrator decision</Text>
    }
    if (m.status === 'SUBMITTED') {
      if (role === 'client') {
        return (
          <Group gap="xs">
            <Button
              color="green"
              size="xs"
              loading={busy}
              disabled={!signer}
              onClick={() => setConfirm({ type: 'approve', milestoneIndex: m.milestone_index })}
            >
              Approve
            </Button>
            <Button
              variant="light"
              color="red"
              size="xs"
              loading={busy}
              disabled={!signer}
              onClick={() => setConfirm({ type: 'dispute', milestoneIndex: m.milestone_index })}
            >
              Raise Dispute
            </Button>
          </Group>
        )
      }
      return <Text size="xs" c="dimmed">Waiting for client approval</Text>
    }
    if (m.status === 'PENDING') {
      if (role === 'freelancer' && escrow.status === 'FUNDED') {
        return (
          <Button
            size="xs"
            loading={busy}
            disabled={!signer}
            onClick={() => setConfirm({ type: 'submit', milestoneIndex: m.milestone_index })}
          >
            Submit
          </Button>
        )
      }
      if (role === 'client' && escrow.status === 'FUNDED' && isOverdue) {
        return (
          <Button
            variant="light"
            color="red"
            size="xs"
            loading={busy}
            disabled={!signer}
            onClick={() => setConfirm({ type: 'refund', milestoneIndex: m.milestone_index })}
          >
            Refund
          </Button>
        )
      }
      return null
    }
    return null
  }

  // ---- 渲染 ----
  if (loadState === 'loading') {
    return <Center py={96}><Loader /></Center>
  }
  if (loadState === 'not-found') {
    return (
      <Center py={96}>
        <Stack align="center" gap="sm">
          <Title order={3}>Escrow not found</Title>
          <Text size="sm" c="dimmed">escrow_id={escrowId} does not exist in the database.</Text>
          <Button component={Link} to="/" variant="subtle" leftSection={<IconArrowLeft size={16} stroke={1.5} />}>
            Back to Dashboard
          </Button>
        </Stack>
      </Center>
    )
  }
  if (loadState === 'error' || !escrow) {
    return (
      <Center py={96}>
        <Stack align="center" gap="sm">
          <Title order={3}>Failed to load escrow</Title>
          <Button leftSection={<IconRefresh size={16} stroke={1.5} />} onClick={reload}>Retry</Button>
        </Stack>
      </Center>
    )
  }

  const modalTitles = {
    fund: 'Fund Escrow',
    submit: `Submit M${confirmMilestone ? confirmMilestone.milestone_index + 1 : ''}`,
    approve: `Approve M${confirmMilestone ? confirmMilestone.milestone_index + 1 : ''}`,
    dispute: `Raise Dispute on M${confirmMilestone ? confirmMilestone.milestone_index + 1 : ''}`,
    refund: `Refund M${confirmMilestone ? confirmMilestone.milestone_index + 1 : ''}`,
    resolve: `Resolve Dispute on M${confirmMilestone ? confirmMilestone.milestone_index + 1 : ''}`,
  }

  return (
    <Stack gap="lg">
      {/* 顶部信息条(ui-design.md 五.1) */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ flex: 1, minWidth: 260 }}>
          <Button
            component={Link}
            to="/"
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={14} stroke={1.5} />}
            pl={0}
            w="fit-content"
          >
            Back to Dashboard
          </Button>
          <Title order={2}>{escrow.title}</Title>
          <Group gap="sm" wrap="nowrap">
            <StatusBadge status={escrow.status} size="lg" />
            <Text size="sm" c="dimmed">
              with <AddressText address={counterparty} />
            </Text>
            {escrow.arbitrator_address && (
              <Text size="sm" c="dimmed">
                · Arbitrator <AddressText address={escrow.arbitrator_address} />
              </Text>
            )}
          </Group>
        </Stack>
        {deadlineText && (
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">Deadline</Text>
            <Text size="sm" fw={600} c={deadlineColor}>{deadlineText}</Text>
            <Text size="xs" c="dimmed">{deadline.format('YYYY-MM-DD')}</Text>
          </Stack>
        )}
      </Group>

      {/* 金额概览(ui-design.md 五.2):已释放/锁定分段进度条 */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Total <Mono inherit>{formatEth(escrow.total_amount_wei)} ETH</Mono>
            </Text>
            <Text size="sm" c="dimmed">
              Released <Mono inherit c="green">{formatEth(releasedWei)} ETH</Mono> · Locked{' '}
              <Mono inherit c="blue">{formatEth(lockedWei)} ETH</Mono>
            </Text>
          </Group>
          <Progress.Root size={24}>
            <Progress.Section value={releasedPct} color="green">
              {releasedPct >= 15 && <Progress.Label>{releasedPct}%</Progress.Label>}
            </Progress.Section>
            <Progress.Section value={100 - releasedPct} color="blue" />
          </Progress.Root>
        </Stack>
      </Card>

      {/* CREATED 状态:client 在此存入资金 */}
      {role === 'client' && escrow.status === 'CREATED' && (
        <Alert variant="light" color="blue" title="Escrow not funded yet">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              Deposit <Mono inherit fw={600}>{formatEth(escrow.total_amount_wei)} ETH</Mono> to lock
              the funds in the contract — they are released milestone by milestone.
            </Text>
            <Button
              leftSection={<IconGavel size={14} stroke={1.5} />}
              loading={actionBusy === 'fund'}
              disabled={!signer}
              onClick={() => setConfirm({ type: 'fund', milestoneIndex: null })}
            >
              Fund Escrow
            </Button>
          </Group>
        </Alert>
      )}

      {/* Milestone Timeline(ui-design.md 五.3) */}
      <Timeline active={escrow.milestones.filter((m) => m.status === 'RELEASED').length} bulletSize={26} lineWidth={2}>
        {escrow.milestones.map((m) => (
          <Timeline.Item
            key={m.milestone_index}
            color={STATUS_COLORS[m.status]}
            title={
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text fw={600} size="sm">
                  M{m.milestone_index + 1} · {m.description}
                </Text>
                <Group gap="sm" wrap="nowrap">
                  <Mono size="sm" c="dimmed">{formatEth(m.amount_wei)} ETH</Mono>
                  <StatusBadge status={m.status} />
                </Group>
              </Group>
            }
          >
            <Group justify="space-between" align="center" mt={4}>
              <Text size="xs" c="dimmed">
                {m.submitted_at ? `Submitted ${dayjs(m.submitted_at).format('YYYY-MM-DD HH:mm')}` : 'Not submitted yet'}
              </Text>
              {milestoneActions(m)}
            </Group>
          </Timeline.Item>
        ))}
      </Timeline>

      {/* 相关交易记录:跳转 History 页并自动带上 escrow 过滤条件(ui-design.md 五.4) */}
      <Card withBorder padding="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Text size="sm" c="dimmed">Related transactions</Text>
          <Button variant="subtle" size="xs" component={Link} to={`/history?escrow=${id}`}>
            View in Transaction History
          </Button>
        </Group>
      </Card>

      {/* 二次确认 Modal(ui-design.md 五.3:每个关键操作单独确认) */}
      <Modal opened={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm ? modalTitles[confirm.type] : ''} centered>
        {confirm?.type === 'fund' && (
          <Stack gap="sm">
            <Text size="sm">
              This will transfer <Mono inherit fw={600}>{formatEth(escrow.total_amount_wei)} ETH</Mono>{' '}
              from your wallet into the escrow contract.
            </Text>
            <Text size="sm" c="dimmed">Funds are only released milestone by milestone.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={fundEscrow}>Fund {formatEth(escrow.total_amount_wei)} ETH</Button>
            </Group>
          </Stack>
        )}

        {confirm?.type === 'submit' && confirmMilestone && (
          <Stack gap="sm">
            <Text size="sm">
              Mark <Mono inherit fw={600}>M{confirmMilestone.milestone_index + 1}</Mono> as delivered
              and request client approval for <Mono inherit>{formatEth(confirmMilestone.amount_wei)} ETH</Mono>.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={() => submitMilestone(confirmMilestone)}>Submit</Button>
            </Group>
          </Stack>
        )}

        {confirm?.type === 'approve' && confirmMilestone && (
          <Stack gap="sm">
            <Text size="sm">
              This will release <Mono inherit fw={600}>{formatEth(confirmMilestone.amount_wei)} ETH</Mono>{' '}
              from the escrow contract to{' '}
              <Mono inherit>{shortenAddress(escrow.freelancer_address)}</Mono>.
            </Text>
            <Text size="sm" c="red">This action is irreversible.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button color="green" onClick={() => approveMilestone(confirmMilestone)}>
                Approve & Release
              </Button>
            </Group>
          </Stack>
        )}

        {confirm?.type === 'dispute' && confirmMilestone && (
          <Stack gap="sm">
            <Text size="sm">
              Dispute <Mono inherit fw={600}>M{confirmMilestone.milestone_index + 1}</Mono>? The
              arbitrator will review the milestone and decide whether to release or refund the{' '}
              <Mono inherit>{formatEth(confirmMilestone.amount_wei)} ETH</Mono>.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button color="red" onClick={() => raiseDispute(confirmMilestone)}>Raise Dispute</Button>
            </Group>
          </Stack>
        )}

        {confirm?.type === 'refund' && confirmMilestone && (
          <Stack gap="sm">
            <Text size="sm">
              The deadline has passed. Refund <Mono inherit fw={600}>{formatEth(confirmMilestone.amount_wei)} ETH</Mono>{' '}
              of <Mono inherit fw={600}>M{confirmMilestone.milestone_index + 1}</Mono> back to your wallet?
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button color="red" onClick={() => refundMilestone(confirmMilestone)}>Refund</Button>
            </Group>
          </Stack>
        )}

        {confirm?.type === 'resolve' && confirmMilestone && (
          <Stack gap="sm">
            <Text size="sm">
              Decide on <Mono inherit fw={600}>M{confirmMilestone.milestone_index + 1}</Mono>{' '}
              (<Mono inherit>{formatEth(confirmMilestone.amount_wei)} ETH</Mono>):
            </Text>
            <Group grow>
              <Button color="green" onClick={() => resolveDispute(confirmMilestone, true)}>
                Release to Freelancer
              </Button>
              <Button color="red" onClick={() => resolveDispute(confirmMilestone, false)}>
                Refund to Client
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}

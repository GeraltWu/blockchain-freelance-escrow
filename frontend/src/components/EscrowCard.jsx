import { Card, Group, Progress, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { AddressText } from './AddressText.jsx'
import { Mono } from './Mono.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { formatEth, getReleasedWei } from '../utils/format.js'

// Dashboard 项目列表卡片(见 docs/ui-design.md「三、Page 1:Dashboard - 3」):
// 标题 / 对方地址 / 状态 Badge / 释放进度条 / 待处理小红点,点击整卡跳转详情页
export function EscrowCard({ escrow }) {
  const { escrow_id: id, title, counterparty, totalWei, status, milestones, pendingLabel } = escrow
  const releasedWei = getReleasedWei(milestones)
  const pct =
    totalWei === '0' ? 0 : Number((BigInt(releasedWei) * 10000n) / BigInt(totalWei)) / 100

  return (
    <Card withBorder padding="lg" className="escrow-card" component={Link} to={`/escrow/${id}`}>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Title order={4} lineClamp={1}>
              {title}
            </Title>
            <AddressText address={counterparty} />
          </Stack>
          <StatusBadge status={status} />
        </Group>

        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Released <Mono inherit size="xs">{formatEth(releasedWei)} ETH</Mono>
            </Text>
            <Text size="xs" c="dimmed">
              Total <Mono inherit size="xs">{formatEth(totalWei)} ETH</Mono>
            </Text>
          </Group>
          <Progress value={pct} size="sm" />
        </Stack>

        {pendingLabel && (
          <Group justify="flex-end" gap={6}>
            <Text size="xs" c="red">
              {pendingLabel}
            </Text>
            <span className="pending-dot" />
          </Group>
        )}
      </Stack>
    </Card>
  )
}

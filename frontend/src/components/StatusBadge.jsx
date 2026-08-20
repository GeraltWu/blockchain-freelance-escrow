import { Badge } from '@mantine/core'

// 状态色规范,见 docs/ui-design.md「状态色规范(贯穿全站)」
const STATUS_COLORS = {
  CREATED: 'gray',
  PENDING: 'gray',
  FUNDED: 'blue',
  SUBMITTED: 'yellow',
  DISPUTED: 'red',
  RELEASED: 'green',
  COMPLETED: 'green',
  REFUNDED: 'dark',
  CANCELLED: 'dark',
}

// 状态徽章:Badge 自带文字标签,颜色只是辅助,不单独承载信息
export function StatusBadge({ status, size }) {
  return (
    <Badge color={STATUS_COLORS[status] ?? 'gray'} variant="light" size={size}>
      {status}
    </Badge>
  )
}

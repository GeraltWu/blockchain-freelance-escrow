import { Badge } from '@mantine/core'
import { STATUS_COLORS } from '../utils/statusColors.js'

// 状态徽章:Badge 自带文字标签,颜色只是辅助,不单独承载信息
export function StatusBadge({ status, size }) {
  return (
    <Badge color={STATUS_COLORS[status] ?? 'gray'} variant="light" size={size}>
      {status}
    </Badge>
  )
}

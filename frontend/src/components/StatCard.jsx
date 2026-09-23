import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { Mono } from './Mono.jsx'

// Dashboard 顶部统计卡片(见 docs/ui-design.md「三、Page 1:Dashboard - 1」)
// 结构:图标在左(纵向居中),右侧大写标签在上 → 大数字(含单位)
// 图标按语义配色(资金绿/待办橙/中性蓝/完成 teal);alert=true 且数值>0 时卡片描边+数字变橙提醒
export function StatCard({ icon: Icon, label, value, unit, color = 'blue', alert = false }) {
  const hasAlert = alert && String(value) !== '0'
  return (
    <Card
      withBorder
      p={{ base: 'sm', sm: 'lg' }}
      style={hasAlert ? { borderColor: 'var(--mantine-color-orange-4)' } : undefined}
    >
      <Group gap={{ base: 'xs', sm: 'md' }} wrap="nowrap" align="center">
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          <Icon size={22} stroke={1.5} />
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" truncate="end" title={label}>
            {label}
          </Text>
          <Mono size="xl" fw={700} lh={1.2} c={hasAlert ? 'orange' : undefined}>
            {value}
            {unit && (
              <Mono size="sm" fw={500} c="dimmed">
                {' '}
                {unit}
              </Mono>
            )}
          </Mono>
        </Stack>
      </Group>
    </Card>
  )
}

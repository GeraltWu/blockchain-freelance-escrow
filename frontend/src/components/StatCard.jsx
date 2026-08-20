import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { Mono } from './Mono.jsx'

// Dashboard 顶部统计卡片(见 docs/ui-design.md「三、Page 1:Dashboard - 1」)
// 数字用等宽字体;图标色统一主色,颜色只留给状态使用
export function StatCard({ icon: Icon, label, value, unit }) {
  return (
    <Card withBorder padding="lg">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color="blue" size={40} radius="md">
          <Icon size={22} stroke={1.5} />
        </ThemeIcon>
        <Stack gap={2}>
          <Mono size="xl" fw={700} lh={1.2}>
            {value}
            {unit && (
              <Mono size="sm" fw={500} c="dimmed">
                {' '}
                {unit}
              </Mono>
            )}
          </Mono>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        </Stack>
      </Group>
    </Card>
  )
}

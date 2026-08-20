import { Button, Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconArrowLeft, IconHammer } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

// 未实现页面的占位。后续按 docs/ui-design.md 三~六 逐个实现:
// Create Escrow(Stepper 表单)/ Escrow Detail(Timeline)/ Transaction History(Table + 分页)
export function ComingSoon({ title, description }) {
  return (
    <Center py={96}>
      <Stack align="center" gap="xs" maw={420}>
        <ThemeIcon variant="light" color="gray" size={64} radius="xl">
          <IconHammer size={30} stroke={1.25} />
        </ThemeIcon>
        <Title order={3} ta="center">
          {title}
        </Title>
        <Text size="sm" c="dimmed" ta="center">
          {description}
        </Text>
        <Button
          variant="subtle"
          component={Link}
          to="/"
          leftSection={<IconArrowLeft size={16} stroke={1.5} />}
          mt="md"
        >
          Back to Dashboard
        </Button>
      </Stack>
    </Center>
  )
}

import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconWallet } from '@tabler/icons-react'

// 未连接钱包时的提示块(Dashboard / Transaction History 共用)
export function ConnectPrompt({ description }) {
  return (
    <Center py={64}>
      <Stack align="center" gap="xs" maw={360}>
        <ThemeIcon variant="light" color="gray" size={64} radius="xl">
          <IconWallet size={32} stroke={1.25} />
        </ThemeIcon>
        <Title order={4} ta="center">
          Connect your wallet
        </Title>
        <Text size="sm" c="dimmed" ta="center">
          {description}
        </Text>
      </Stack>
    </Center>
  )
}

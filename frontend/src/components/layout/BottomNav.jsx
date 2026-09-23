import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { Link, useLocation } from 'react-router-dom'
import { NAV_LINKS } from './navLinks.js'

// 手机端一级导航：三个高频入口始终可见，避免每次先打开汉堡菜单。
export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <Box component="nav" className="bottom-nav" hiddenFrom="sm" aria-label="Primary navigation">
      <Group h="100%" grow gap={0} wrap="nowrap">
        {NAV_LINKS.map(({ to, label, icon: Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to)

          return (
            <UnstyledButton
              key={to}
              component={Link}
              to={to}
              className="bottom-nav-link"
              data-active={active || undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Stack align="center" justify="center" gap={2} h="100%">
                <Icon size={21} stroke={active ? 2 : 1.5} />
                <Text size="xs" fw={active ? 600 : 500} inherit>
                  {label === 'Create Escrow' ? 'Create' : label === 'Transaction History' ? 'History' : label}
                </Text>
              </Stack>
            </UnstyledButton>
          )
        })}
      </Group>
    </Box>
  )
}

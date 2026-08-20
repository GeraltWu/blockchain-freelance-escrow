import { NavLink, Stack } from '@mantine/core'
import { IconHistory, IconHome2, IconPlus } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'

// 左侧导航:当前选中项高亮(见 docs/ui-design.md「二、整体布局结构 - Navbar」)
const LINKS = [
  { to: '/', label: 'Dashboard', icon: IconHome2, end: true },
  { to: '/create', label: 'Create Escrow', icon: IconPlus, end: false },
  { to: '/history', label: 'Transaction History', icon: IconHistory, end: false },
]

export function SideNav({ onNavigate }) {
  const { pathname } = useLocation()

  return (
    <Stack gap={4} p="md">
      {LINKS.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === to : pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<Icon size={18} stroke={1.5} />}
            active={active}
            variant="light"
            onClick={onNavigate}
          />
        )
      })}
    </Stack>
  )
}

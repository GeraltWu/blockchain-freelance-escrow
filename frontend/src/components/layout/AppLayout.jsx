import { AppShell, Container } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from 'react-router-dom'
import { HeaderBar } from './HeaderBar.jsx'
import { SideNav } from './SideNav.jsx'

// 全站布局:顶部 Header + 左侧 Navbar(移动端折叠成汉堡菜单)
// 见 docs/ui-design.md「二、整体布局结构」
export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <HeaderBar opened={opened} onToggle={toggle} />
      </AppShell.Header>
      <AppShell.Navbar>
        <SideNav onNavigate={close} />
      </AppShell.Navbar>
      <AppShell.Main>
        {/* 顶部紧凑(AppShell 本身已有 md 边距),底部留足呼吸空间 */}
        <Container size="lg" pt="sm" pb="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

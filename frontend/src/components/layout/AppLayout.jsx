import { AppShell, Container } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav.jsx'
import { HeaderBar } from './HeaderBar.jsx'
import { SideNav } from './SideNav.jsx'

// 全站布局：桌面端左侧导航，移动端底部导航。
// 见 docs/ui-design.md「二、整体布局结构」
export function AppLayout() {
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }}
      padding={{ base: 'xs', sm: 'md' }}
    >
      <AppShell.Header>
        <HeaderBar />
      </AppShell.Header>
      <AppShell.Navbar>
        <SideNav />
      </AppShell.Navbar>
      <AppShell.Main>
        <Container size="lg" pt="sm" pb={{ base: 88, sm: 'xl' }}>
          <Outlet />
        </Container>
      </AppShell.Main>
      <BottomNav />
    </AppShell>
  )
}

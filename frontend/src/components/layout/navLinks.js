import { IconHistory, IconHome2, IconPlus } from '@tabler/icons-react'

export const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: IconHome2, end: true },
  { to: '/create', label: 'Create Escrow', icon: IconPlus, end: false },
  { to: '/history', label: 'Transaction History', icon: IconHistory, end: false },
]

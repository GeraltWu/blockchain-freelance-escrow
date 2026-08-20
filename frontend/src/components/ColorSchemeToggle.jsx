import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

// 深色模式切换(见 docs/ui-design.md「一、整体视觉风格」)
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
    >
      {computed === 'dark' ? <IconSun size={18} stroke={1.5} /> : <IconMoon size={18} stroke={1.5} />}
    </ActionIcon>
  )
}

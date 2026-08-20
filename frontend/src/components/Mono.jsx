import { Text, useMantineTheme } from '@mantine/core'

// 等宽字体文字:金额、地址、哈希统一用它展示(见 docs/ui-design.md「一、整体视觉风格」)
export function Mono({ style, ...props }) {
  const theme = useMantineTheme()
  return (
    <Text
      component="span"
      {...props}
      style={{ fontFamily: theme.fontFamilyMonospace, ...style }}
    />
  )
}

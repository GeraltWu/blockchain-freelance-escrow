import { createTheme } from '@mantine/core'

// 主题配置,见 docs/ui-design.md「一、整体视觉风格」
export const theme = createTheme({
  // 主色:蓝色,代表信任/金融,符合托管类产品的稳重感
  primaryColor: 'blue',

  // 金额/地址/哈希统一用等宽字体展示(通过 Mono 组件引用)
  fontFamilyMonospace:
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',

  defaultRadius: 'md',
})

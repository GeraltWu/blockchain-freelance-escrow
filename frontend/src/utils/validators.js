// 前端表单校验规则(对应 docs/architecture.md utils/validators.js)
// 与后端 app/utils/validators.py 保持同一套规则:双层验证(见初步设计.md 十七)

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

// 以太坊地址:0x + 40 位十六进制(不校验 checksum)
export function isEthAddress(value) {
  return typeof value === 'string' && ADDRESS_RE.test(value)
}

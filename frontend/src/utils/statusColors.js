// 状态色规范,见 docs/ui-design.md「状态色规范(贯穿全站)」
// 单独文件,供 StatusBadge / Timeline bullet 等组件复用
// (react-refresh 要求常量不与组件混出)
export const STATUS_COLORS = {
  CREATED: 'gray',
  PENDING: 'gray',
  FUNDED: 'blue',
  SUBMITTED: 'yellow',
  DISPUTED: 'red',
  RELEASED: 'green',
  COMPLETED: 'green',
  REFUNDED: 'dark',
  CANCELLED: 'dark',
  // 交易状态(data-model.md 2.3)
  CONFIRMED: 'green',
  FAILED: 'red',
}

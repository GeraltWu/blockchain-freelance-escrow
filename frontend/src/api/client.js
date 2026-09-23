import axios from 'axios'

// 默认使用同域 /api：开发环境由 Vite 代理，生产环境由 Nginx 代理。
// 仅在 API 独立部署到其他域名时，才需要通过 VITE_API_BASE_URL 覆盖。
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
})

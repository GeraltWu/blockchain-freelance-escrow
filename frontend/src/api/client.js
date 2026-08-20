import axios from 'axios'

// 后端 REST 客户端(对应 docs/architecture.md 的 api/client.js)
// VITE_API_BASE_URL 可在 frontend/.env 覆盖,默认本地 Flask(见 frontend/.env.example)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api',
  timeout: 8000,
})

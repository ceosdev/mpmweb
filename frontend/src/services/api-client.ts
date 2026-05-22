import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authStorage } from '@/lib/auth-storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api'

/**
 * Host portion of the API URL, used to resolve static assets served outside
 * the `/api` prefix (e.g. `/uploads/...` for company logos).
 */
const ASSET_BASE_URL = API_URL.replace(/\/api\/?$/, '')

/**
 * Resolves a server-stored asset path (relative, like `/uploads/logos/x.png`)
 * to an absolute URL the browser can fetch. Returns `null` when the path is
 * empty.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${ASSET_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * Central Axios instance. Every request automatically carries:
 *  - the JWT access token (`Authorization` header)
 *  - the active company id (`x-company-id` header) — drives multi-tenancy
 *
 * On a `401` the client transparently refreshes the access token once and
 * retries the original request; if the refresh fails the session is cleared.
 */
export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const companyId = authStorage.getCompanyId()
  if (companyId) {
    config.headers['x-company-id'] = String(companyId)
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
    authStorage.setTokens(data.accessToken, data.refreshToken)
    return data.accessToken as string
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthRoute = original?.url?.includes('/auth/')

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true

      refreshing = refreshing ?? refreshAccessToken()
      const newToken = await refreshing
      refreshing = null

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }

      authStorage.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

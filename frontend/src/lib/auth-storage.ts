/**
 * Persists the auth session in `localStorage` so it survives page reloads.
 * Tokens and the active company id are kept here; the API client and the
 * AuthProvider both read from it.
 */
const KEYS = {
  access: 'mpm.accessToken',
  refresh: 'mpm.refreshToken',
  company: 'mpm.companyId',
} as const

export const authStorage = {
  getAccessToken: () => localStorage.getItem(KEYS.access),
  getRefreshToken: () => localStorage.getItem(KEYS.refresh),

  getCompanyId: (): number | null => {
    const value = localStorage.getItem(KEYS.company)
    return value ? Number(value) : null
  },

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(KEYS.access, accessToken)
    localStorage.setItem(KEYS.refresh, refreshToken)
  },

  setCompanyId(id: number) {
    localStorage.setItem(KEYS.company, String(id))
  },

  clearCompany() {
    localStorage.removeItem(KEYS.company)
  },

  clear() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key))
  },
}

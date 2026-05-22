import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/services/auth-api'
import { authStorage } from '@/lib/auth-storage'
import type { AuthUser, CompanySummary, TenantContext } from '@/types/api'

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  /** Companies the user can switch into. */
  companies: CompanySummary[]
  activeCompanyId: number | null
  /** Resolved permissions/role for the active company (null until selected). */
  tenant: TenantContext | null
  login: (email: string, password: string) => Promise<{ companies: CompanySummary[] }>
  selectCompany: (companyId: number) => Promise<void>
  logout: () => Promise<void>
  refreshContext: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Global authentication + multi-tenant state.
 *
 * Holds the session (user, tokens), the list of companies the user can
 * enter, the currently active company and its resolved permission set.
 * Switching company re-resolves permissions, which in turn re-renders the
 * dynamic menu and every permission-gated element.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null)
  const [tenant, setTenant] = useState<TenantContext | null>(null)

  const loadContext = useCallback(async () => {
    const data = await authApi.context()
    setTenant(data.tenant)
  }, [])

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!authStorage.getAccessToken()) {
        setStatus('unauthenticated')
        return
      }

      try {
        const me = await authApi.me()
        if (cancelled) return
        setUser(me.user)
        setCompanies(me.companies)

        const storedCompanyId = authStorage.getCompanyId()
        const isValid = storedCompanyId !== null && me.companies.some((c) => c.id === storedCompanyId)

        if (isValid) {
          await loadContext()
          if (cancelled) return
          setActiveCompanyId(storedCompanyId)
        } else {
          authStorage.clearCompany()
        }
        setStatus('authenticated')
      } catch {
        if (cancelled) return
        authStorage.clear()
        setStatus('unauthenticated')
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadContext])

  const selectCompany = useCallback(
    async (companyId: number) => {
      authStorage.setCompanyId(companyId)
      setActiveCompanyId(companyId)
      await loadContext()
    },
    [loadContext]
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password)
      authStorage.setTokens(result.accessToken, result.refreshToken)
      authStorage.clearCompany()

      setUser(result.user)
      setCompanies(result.companies)
      setTenant(null)
      setActiveCompanyId(null)
      setStatus('authenticated')

      // A single company? Enter it automatically.
      if (result.companies.length === 1) {
        await selectCompany(result.companies[0].id)
      }

      return { companies: result.companies }
    },
    [selectCompany]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Stateless logout — ignore network errors.
    }
    authStorage.clear()
    setUser(null)
    setCompanies([])
    setTenant(null)
    setActiveCompanyId(null)
    setStatus('unauthenticated')
  }, [])

  const value: AuthContextValue = {
    status,
    user,
    companies,
    activeCompanyId,
    tenant,
    login,
    selectCompany,
    logout,
    refreshContext: loadContext,
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.')
  }
  return context
}

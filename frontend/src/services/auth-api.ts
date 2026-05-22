import { api } from '@/services/api-client'
import type { ContextResponse, LoginResponse, MeResponse } from '@/types/api'

/**
 * Authentication endpoints.
 */
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  me: () => api.get<MeResponse>('/auth/me').then((r) => r.data),

  /** Resolves permissions/role for the active company (needs x-company-id). */
  context: () => api.get<ContextResponse>('/me/context').then((r) => r.data),

  logout: () => api.post('/auth/logout').then(() => undefined),

  forgotPassword: (email: string) =>
    api
      .post<{ message: string; devToken?: string }>('/auth/forgot-password', { email })
      .then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),
}

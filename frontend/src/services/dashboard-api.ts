import { api } from '@/services/api-client'
import type { DashboardStats } from '@/types/api'

/**
 * Dashboard endpoints.
 */
export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard').then((r) => r.data),
}

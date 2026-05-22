import { HttpContext } from '@adonisjs/core/http'
import dashboardService from '#services/dashboard_service'

/**
 * Dashboard metrics for the active empresa.
 */
export default class DashboardController {
  async index({ tenant }: HttpContext) {
    return dashboardService.getStats(tenant)
  }
}

import { HttpContext } from '@adonisjs/core/http'
import payableSettlementService from '#services/payable_settlement_service'
import {
  createPayableSettlementValidator,
  updatePayableSettlementValidator,
} from '#validators/payable_settlement_validators'

/**
 * Baixas scoped to a parent payable (`/api/payables/:payableId/settlements`).
 * `payableId` is always read from the path; clients cannot inject a parent via
 * body. Every write recomputes the parent title (in the service, transactional).
 */
export default class PayableSettlementsController {
  async index({ tenant, params }: HttpContext) {
    return payableSettlementService.list(tenant, Number(params.payableId))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createPayableSettlementValidator)
    const row = await payableSettlementService.create(tenant, Number(params.payableId), payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updatePayableSettlementValidator)
    return payableSettlementService.update(
      tenant,
      Number(params.payableId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await payableSettlementService.destroy(tenant, Number(params.payableId), Number(params.id))
    return response.noContent()
  }
}

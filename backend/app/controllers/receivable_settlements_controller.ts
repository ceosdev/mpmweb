import { HttpContext } from '@adonisjs/core/http'
import receivableSettlementService from '#services/receivable_settlement_service'
import {
  batchReceivableSettlementValidator,
  createReceivableSettlementValidator,
  updateReceivableSettlementValidator,
} from '#validators/receivable_settlement_validators'

/**
 * Baixas scoped to a parent receivable (`/api/receivables/:receivableId/settlements`).
 * `receivableId` is always read from the path; clients cannot inject a parent via
 * body. Every write recomputes the parent title (in the service, transactional).
 */
export default class ReceivableSettlementsController {
  async index({ tenant, params }: HttpContext) {
    return receivableSettlementService.list(tenant, Number(params.receivableId))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createReceivableSettlementValidator)
    const row = await receivableSettlementService.create(
      tenant,
      Number(params.receivableId),
      payload
    )
    return response.created(row)
  }

  /**
   * Recebimento em lote: `receivableId` **não** vem do path (opera sobre vários
   * títulos), vem no corpo. Cria uma baixa por título numa única transação.
   */
  async batchStore({ tenant, request }: HttpContext) {
    const { receivableIds, paymentTypeId } = await request.validateUsing(
      batchReceivableSettlementValidator
    )
    return receivableSettlementService.batchCreate(tenant, receivableIds, paymentTypeId)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateReceivableSettlementValidator)
    return receivableSettlementService.update(
      tenant,
      Number(params.receivableId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await receivableSettlementService.destroy(
      tenant,
      Number(params.receivableId),
      Number(params.id)
    )
    return response.noContent()
  }
}

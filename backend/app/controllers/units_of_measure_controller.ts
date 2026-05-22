import { HttpContext } from '@adonisjs/core/http'
import unitOfMeasureService from '#services/unit_of_measure_service'
import {
  createUnitOfMeasureValidator,
  updateUnitOfMeasureValidator,
} from '#validators/unit_of_measure_validators'

export default class UnitsOfMeasureController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return unitOfMeasureService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return unitOfMeasureService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createUnitOfMeasureValidator)
    const row = await unitOfMeasureService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateUnitOfMeasureValidator)
    return unitOfMeasureService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await unitOfMeasureService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}

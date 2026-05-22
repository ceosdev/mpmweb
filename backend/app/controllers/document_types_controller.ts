import { HttpContext } from '@adonisjs/core/http'
import documentTypeService from '#services/document_type_service'
import {
  createDocumentTypeValidator,
  updateDocumentTypeValidator,
} from '#validators/document_type_validators'

export default class DocumentTypesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return documentTypeService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return documentTypeService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createDocumentTypeValidator)
    const row = await documentTypeService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateDocumentTypeValidator)
    return documentTypeService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await documentTypeService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}

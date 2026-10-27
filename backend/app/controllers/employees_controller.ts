import { HttpContext } from '@adonisjs/core/http'
import { lookupValidator } from '#validators/lookup_validators'
import { parseLookupIds } from '#utils/lookup'
import employeeService from '#services/employee_service'
import {
  createEmployeeValidator,
  updateEmployeeValidator,
} from '#validators/employee_validators'

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw
  return undefined
}

export default class EmployeesController {
  /** EntityPicker lookup — see `EmployeeService.lookup`. */
  async lookup({ tenant, request }: HttpContext) {
    const payload = await request.validateUsing(lookupValidator)
    return employeeService.lookup(tenant, {
      q: payload.q,
      ids: parseLookupIds(payload.ids),
      limit: payload.limit,
    })
  }

  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return employeeService.list(tenant, {
      id: request.input('id') ? Number(request.input('id')) : undefined,
      name: request.input('name') || undefined,
      taxId: request.input('taxId') || undefined,
      status: parseStatus(request.input('status')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return employeeService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createEmployeeValidator)
    const row = await employeeService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateEmployeeValidator)
    return employeeService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await employeeService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}

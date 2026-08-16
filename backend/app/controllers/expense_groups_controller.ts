import { HttpContext } from '@adonisjs/core/http'
import expenseGroupService from '#services/expense_group_service'
import {
  createExpenseGroupValidator,
  updateExpenseGroupValidator,
} from '#validators/expense_group_validators'

export default class ExpenseGroupsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return expenseGroupService.list(tenant, {
      id: request.input('id') ? Number(request.input('id')) : undefined,
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return expenseGroupService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createExpenseGroupValidator)
    const row = await expenseGroupService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateExpenseGroupValidator)
    return expenseGroupService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await expenseGroupService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}

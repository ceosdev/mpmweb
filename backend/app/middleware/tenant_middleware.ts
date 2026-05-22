import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import Company from '#models/company'
import permissionService from '#services/permission_service'
import { AppException, ForbiddenException, NotFoundException } from '#exceptions/app_exception'

/**
 * Resolves the active company from the `x-company-id` header, verifies the
 * user has access to it and attaches the resolved `TenantContext` to
 * `ctx.tenant`. Must run after the `auth` middleware.
 */
export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const rawId = ctx.request.header('x-company-id')
    if (!rawId) {
      throw new AppException('Empresa ativa não informada (header x-company-id).')
    }

    const companyId = Number(rawId)
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new AppException('Identificador de empresa inválido.')
    }

    const company = await Company.query()
      .where('id', companyId)
      .where('is_active', true)
      .whereNull('deleted_at')
      .first()

    if (!company) {
      throw new NotFoundException('Empresa não encontrada ou inativa.')
    }

    const tenant = await permissionService.buildContext(ctx.currentUser, company)
    if (!tenant) {
      throw new ForbiddenException('Você não tem acesso a esta empresa.')
    }

    ctx.tenant = tenant
    return next()
  }
}

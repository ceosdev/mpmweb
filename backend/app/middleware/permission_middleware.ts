import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import { ForbiddenException } from '#exceptions/app_exception'

/**
 * Route-level RBAC guard. Usage in routes:
 *
 *   router.post('/usuarios', [UsuariosController, 'store'])
 *     .use(middleware.permission('usuarios.criar'))
 *
 * All listed permissions are required. ROOT users (wildcard) always pass.
 * Must run after the `tenant` middleware.
 */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, required: string | string[]) {
    const permissions = Array.isArray(required) ? required : [required]

    const allowed = permissions.every((permission) => ctx.tenant.can(permission))
    if (!allowed) {
      throw new ForbiddenException('Você não possui permissão para executar esta ação.')
    }

    return next()
  }
}

import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'
import jwtService from '#services/jwt_service'
import { UnauthorizedException } from '#exceptions/app_exception'

/**
 * Authenticates the request from a `Bearer` JWT access token and attaches the
 * resolved user to `ctx.currentUser`.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente.')
    }

    const payload = jwtService.verify(header.slice(7).trim(), 'access')

    const user = await User.query()
      .where('id', payload.sub)
      .where('is_active', true)
      .whereNull('deleted_at')
      .first()

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.')
    }

    ctx.currentUser = user
    return next()
  }
}

import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import authService from '#services/auth_service'
import {
  loginValidator,
  refreshValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '#validators/auth_validators'

/**
 * Authentication endpoints. Login returns the access/refresh token pair plus
 * the companies the user can enter, so the frontend can decide between
 * auto-entering the only company or showing the company picker.
 */
export default class AuthController {
  async login({ request }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    return authService.login(email, password)
  }

  async refresh({ request }: HttpContext) {
    const { refreshToken } = await request.validateUsing(refreshValidator)
    return authService.refresh(refreshToken)
  }

  /** Stateless JWT — logging out just means the client discards its tokens. */
  async logout({ response }: HttpContext) {
    return response.noContent()
  }

  async me({ currentUser }: HttpContext) {
    return authService.me(currentUser)
  }

  async forgotPassword({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    const token = await authService.forgotPassword(email)

    const payload: Record<string, unknown> = {
      message: 'Se o e-mail estiver cadastrado, enviaremos instruções de recuperação.',
    }
    // Convenience for local development — there is no mailer configured.
    if (token && !app.inProduction) {
      payload.devToken = token
    }
    return payload
  }

  async resetPassword({ request }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    await authService.resetPassword(token, password)
    return { message: 'Senha atualizada com sucesso.' }
  }
}

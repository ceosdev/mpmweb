import jwt from 'jsonwebtoken'
import env from '#start/env'
import { UnauthorizedException } from '#exceptions/app_exception'

/**
 * Token kinds issued by the platform. `access` authenticates API requests,
 * `refresh` mints new access tokens, `password_reset` authorizes a password
 * change without storing anything in the database (stateless reset).
 */
export type TokenType = 'access' | 'refresh' | 'password_reset'

interface TokenPayload {
  sub: number
  type: TokenType
}

const SECRET = env.get('JWT_SECRET')

/**
 * Thin wrapper around `jsonwebtoken`. Keeps signing/verification in one place
 * so the rest of the app never touches the library directly.
 */
export class JwtService {
  private sign(userId: number, type: TokenType, expiresIn: string): string {
    const payload: TokenPayload = { sub: userId, type }
    return jwt.sign(payload, SECRET, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    })
  }

  generateAccessToken(userId: number): string {
    return this.sign(userId, 'access', env.get('JWT_ACCESS_EXPIRES'))
  }

  generateRefreshToken(userId: number): string {
    return this.sign(userId, 'refresh', env.get('JWT_REFRESH_EXPIRES'))
  }

  generatePasswordResetToken(userId: number): string {
    return this.sign(userId, 'password_reset', '30m')
  }

  /**
   * Verify a token and assert its type. Throws `UnauthorizedException` for
   * any invalid, expired or mismatched token.
   */
  verify(token: string, expectedType: TokenType): TokenPayload {
    try {
      const payload = jwt.verify(token, SECRET) as unknown as TokenPayload
      if (payload.type !== expectedType) {
        throw new UnauthorizedException('Token inválido para esta operação.')
      }
      return payload
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('Sessão inválida ou expirada.')
    }
  }
}

export default new JwtService()

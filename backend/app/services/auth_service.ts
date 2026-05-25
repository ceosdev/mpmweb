import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type User from '#models/user'
import jwtService from '#services/jwt_service'
import userRepository from '#repositories/user_repository'
import membershipRepository from '#repositories/membership_repository'
import companyRepository from '#repositories/company_repository'
import { UnauthorizedException, NotFoundException } from '#exceptions/app_exception'

/** A company the user can switch into, returned by the login/me endpoints. */
export interface CompanySummary {
  id: number
  legalName: string
  tradeName: string | null
  slug: string
  /** Relative path under the API host (`/uploads/logos/...`) or null. */
  logoUrl: string | null
  role: string | null
}

export interface AuthResult {
  user: { id: number; name: string; email: string; isRoot: boolean }
  companies: CompanySummary[]
  accessToken: string
  refreshToken: string
}

/**
 * Authentication use cases: login, token refresh and stateless password
 * recovery (the reset token is a short-lived JWT — no DB table needed).
 */
export class AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email)

    if (!user || !user.isActive) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const passwordOk = await hash.verify(user.password, password)
    if (!passwordOk) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    user.lastLoginAt = DateTime.now()
    await user.save()

    return this.buildAuthResult(user)
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = jwtService.verify(refreshToken, 'refresh')
    const user = await userRepository.findById(payload.sub)

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessão inválida.')
    }

    return this.buildAuthResult(user)
  }

  /** Current user plus the companies they can access. */
  async me(user: User) {
    return {
      user: this.serializeUser(user),
      companies: await this.listAccessibleCompanies(user),
    }
  }

  /**
   * Generates a password reset token. There is no mail infrastructure in this
   * bootstrap, so the token is logged — wire up a mailer to deliver it.
   * Always succeeds (does not reveal whether the e-mail exists).
   */
  async forgotPassword(email: string): Promise<string | null> {
    const user = await userRepository.findByEmail(email)
    if (!user || !user.isActive) {
      return null
    }

    const token = jwtService.generatePasswordResetToken(user.id)
    logger.info({ email, resetToken: token }, 'Password reset token generated')
    return token
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const payload = jwtService.verify(token, 'password_reset')
    const user = await userRepository.findById(payload.sub)
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.')
    }

    user.password = newPassword
    await user.save()
  }

  private async buildAuthResult(user: User): Promise<AuthResult> {
    return {
      user: this.serializeUser(user),
      companies: await this.listAccessibleCompanies(user),
      accessToken: jwtService.generateAccessToken(user.id),
      refreshToken: jwtService.generateRefreshToken(user.id),
    }
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isRoot: user.isRoot,
    }
  }

  /**
   * Companies the user is allowed to enter. Root users can access every
   * active company; regular users only the ones they have a membership in.
   */
  async listAccessibleCompanies(user: User): Promise<CompanySummary[]> {
    if (user.isRoot) {
      const companies = await companyRepository.listActive()
      return companies.map((company) => ({
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        slug: company.slug,
        logoUrl: company.logoPath ?? null,
        role: 'root',
      }))
    }

    const memberships = await membershipRepository.listByUser(user.id)
    return memberships
      .filter((m) => m.company && m.company.isActive && !m.company.deletedAt)
      .map((m) => ({
        id: m.company.id,
        legalName: m.company.legalName,
        tradeName: m.company.tradeName,
        slug: m.company.slug,
        logoUrl: m.company.logoPath ?? null,
        role: m.role?.slug ?? null,
      }))
  }
}

export default new AuthService()

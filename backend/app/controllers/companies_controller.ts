import { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import companyService from '#services/company_service'
import { createCompanyValidator, updateCompanyValidator } from '#validators/company_validators'
import { BusinessException } from '#exceptions/app_exception'

const LOGO_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const
const LOGO_MAX_SIZE = '2mb'

/**
 * CRUD for companies. Root users manage every company; other roles only see
 * and edit the company they are currently in (enforced inside the service).
 *
 * Create and update accept `multipart/form-data` so the logomark can be
 * uploaded in the same request as the textual fields.
 */
export default class CompaniesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return companyService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return companyService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCompanyValidator)
    const logo = this.readLogo(request)

    let company = await companyService.create(payload)

    if (logo) {
      try {
        company = await companyService.setLogo(tenant, company.id, logo)
      } catch (error) {
        // Rollback: soft-delete the company we just created so we don't
        // leave a half-finished record behind.
        await companyService.destroy(tenant, company.id).catch((cleanupError) => {
          logger.error(
            { err: cleanupError, companyId: company.id },
            'Failed to rollback company after logo upload error'
          )
        })
        throw error
      }
    }

    return response.created(company)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateCompanyValidator)
    const logo = this.readLogo(request)
    const companyId = Number(params.id)

    let company = await companyService.update(tenant, companyId, payload)

    if (logo) {
      company = await companyService.setLogo(tenant, companyId, logo)
    } else if (payload.removeLogo) {
      company = await companyService.removeLogo(tenant, companyId)
    }

    return company
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await companyService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  /**
   * Reads and validates the optional `logo` multipart file. Returns the
   * MultipartFile when present, `null` when absent. Throws BusinessException
   * with a user-friendly message when the upload itself is invalid.
   */
  private readLogo(request: HttpContext['request']) {
    const file = request.file('logo', {
      size: LOGO_MAX_SIZE,
      extnames: [...LOGO_ALLOWED_EXTENSIONS],
    })
    if (!file) return null
    if (!file.isValid) {
      const message = file.errors[0]?.message ?? 'Logomarca inválida.'
      throw new BusinessException(this.translateUploadError(message))
    }
    return file
  }

  private translateUploadError(message: string): string {
    if (/size/i.test(message)) {
      return 'A logomarca deve ter no máximo 2 MB.'
    }
    if (/extension|extname/i.test(message)) {
      return 'A logomarca deve ser PNG, JPG, JPEG, WEBP ou SVG.'
    }
    return message
  }
}

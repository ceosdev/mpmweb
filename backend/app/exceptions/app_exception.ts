import { Exception } from '@adonisjs/core/exceptions'

/**
 * Base application exception. Carries an HTTP status and a machine-readable
 * code so the frontend can react consistently. The default exception handler
 * already renders these as JSON.
 */
export class AppException extends Exception {
  static status = 400
  static code = 'E_APP_ERROR'
}

/** 401 — request is not authenticated. */
export class UnauthorizedException extends AppException {
  static status = 401
  static code = 'E_UNAUTHORIZED'
}

/** 403 — authenticated but not allowed. */
export class ForbiddenException extends AppException {
  static status = 403
  static code = 'E_FORBIDDEN'
}

/** 404 — resource does not exist (or is not visible to this tenant). */
export class NotFoundException extends AppException {
  static status = 404
  static code = 'E_NOT_FOUND'
}

/** 422 — a business rule rejected the request. */
export class BusinessException extends AppException {
  static status = 422
  static code = 'E_BUSINESS_RULE'
}

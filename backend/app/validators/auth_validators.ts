import vine from '@vinejs/vine'

/**
 * Validators for the authentication flow. All request payloads are validated
 * with VineJS before reaching the controllers.
 */

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().toLowerCase(),
    password: vine.string().minLength(1),
  })
)

export const refreshValidator = vine.compile(
  vine.object({
    refreshToken: vine.string().trim().minLength(10),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().toLowerCase(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(10),
    password: vine.string().minLength(8).maxLength(120),
  })
)

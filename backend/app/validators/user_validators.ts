import vine from '@vinejs/vine'

/**
 * Validators for the Users module.
 */

export const createUserValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(120),
    email: vine.string().trim().email().toLowerCase(),
    password: vine.string().minLength(8).maxLength(120),
    roleId: vine.number().positive(),
    isActive: vine.boolean().optional(),
    extraPermissions: vine.array(vine.number().positive()).optional(),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(120).optional(),
    password: vine.string().minLength(8).maxLength(120).optional(),
    roleId: vine.number().positive().optional(),
    isActive: vine.boolean().optional(),
    extraPermissions: vine.array(vine.number().positive()).optional(),
  })
)

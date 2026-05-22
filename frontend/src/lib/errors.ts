import { AxiosError } from 'axios'

/**
 * Extracts a human-readable (Portuguese) message from an API error.
 * Handles both AdonisJS validation errors (`{ errors: [...] }`) and the
 * application's own exceptions (`{ message }`).
 */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; errors?: { message?: string }[] }
      | undefined
    return data?.errors?.[0]?.message ?? data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

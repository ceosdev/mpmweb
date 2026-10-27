/** Drive disk where company logos are stored. */
export const LOGO_DISK = 'fs'
export const LOGO_KEY_PREFIX = 'logos'
/** URL prefix served by drive (`routeBasePath` in config/drive.ts). */
export const LOGO_URL_PREFIX = '/uploads'

/** Extracts the drive key (`logos/abc.png`) from the stored path (`/uploads/logos/abc.png`). */
export function logoKeyFromPath(logoPath: string | null): string | null {
  if (!logoPath) return null
  if (logoPath.startsWith(`${LOGO_URL_PREFIX}/`)) {
    return logoPath.slice(LOGO_URL_PREFIX.length + 1)
  }
  return logoPath
}

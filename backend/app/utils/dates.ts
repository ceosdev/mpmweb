import { DateTime } from 'luxon'

/**
 * The application runs with `TZ=UTC` (see `.env`), so "today" must be converted
 * explicitly — otherwise the day would roll over at 21:00 in Brazil, and a title
 * due today would be reported as overdue during the last hours of the day.
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo'

/** Today in the application's timezone, as `YYYY-MM-DD` (never UTC's today). */
export function todayIso(): string {
  return DateTime.now().setZone(APP_TIME_ZONE).toISODate()!
}

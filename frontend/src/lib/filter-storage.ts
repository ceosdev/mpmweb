/**
 * Persists listing filters in `sessionStorage`, so they survive leaving the
 * listing (e.g. opening a record) and coming back — but die with the tab.
 *
 * One entry per (company, route): filters hold company-specific ids
 * (supplier, customer…) and must never leak to another company.
 */
const PREFIX = 'mpm.filters:'

export interface StoredFilters<T> {
  draft: T
  applied: T
}

function safe<R>(fn: () => R, fallback: R): R {
  try {
    return fn()
  } catch {
    // Storage blocked/full/corrupted — filters just don't persist.
    return fallback
  }
}

export const filterStorage = {
  key: (companyId: number | undefined, pathname: string) =>
    `${PREFIX}${companyId ?? 'none'}:${pathname}`,

  /**
   * Reads the saved filters merged over `defaults`: keys the screen no longer
   * has are dropped and new keys get their default, so a changed filter shape
   * never breaks an old saved entry.
   */
  read<T extends Record<string, unknown>>(key: string, defaults: T): StoredFilters<T> | null {
    return safe(() => {
      const raw = sessionStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<StoredFilters<Partial<T>>>
      const merge = (value: Partial<T> | undefined) => {
        const result = { ...defaults }
        for (const k of Object.keys(defaults) as (keyof T)[]) {
          if (value && k in value) result[k] = value[k] as T[keyof T]
        }
        return result
      }
      return { draft: merge(parsed.draft), applied: merge(parsed.applied) }
    }, null)
  },

  write<T>(key: string, value: StoredFilters<T>) {
    safe(() => sessionStorage.setItem(key, JSON.stringify(value)), undefined)
  },

  remove(key: string) {
    safe(() => sessionStorage.removeItem(key), undefined)
  },

  /** Drops every saved filter — called on logout. */
  clearAll() {
    safe(() => {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => sessionStorage.removeItem(k))
    }, undefined)
  },
}

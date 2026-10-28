/**
 * Resolves the `?sort=` key of a list against a whitelist of sortable columns
 * or SQL expressions. Only the map's **own** keys count: a plain object lookup
 * would also resolve inherited names (`?sort=constructor`, `?sort=toString`)
 * to functions and send them to the query builder as a column.
 */
export function pickSort<T>(map: Record<string, T>, key: string | null | undefined): T | undefined {
  return key && Object.hasOwn(map, key) ? map[key] : undefined
}

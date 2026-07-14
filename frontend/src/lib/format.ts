/**
 * Small formatting helpers shared across the UI.
 */

/** Up-to-two-letter initials for an avatar fallback. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** ISO date string to `dd/mm/aaaa`, or `—` when empty. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

/**
 * `YYYY-MM-DD` → `dd/mm/aaaa`, **sem passar por Date**.
 *
 * `new Date('2026-07-13')` é interpretado como meia-noite **UTC**, e no fuso do
 * Brasil (UTC-3) volta como dia 12 — um dia a menos. Para colunas date-only
 * (vencimento, emissão) a conversão de fuso não só é desnecessária como está
 * errada: a data não tem hora nenhuma. Aqui só reordenamos o texto.
 */
export function formatIsoDate(iso: string | null): string {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

/** Hoje como `YYYY-MM-DD`, no fuso local (nunca via `toISOString()`, que é UTC). */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/** Primeiro e último dia do mês corrente, como `YYYY-MM-DD`. */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toIsoDate(first), to: toIsoDate(last) }
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

import { maskQuantity } from '@/lib/masks'

/** "3.5000" → "3,5" (pt-BR, sem zeros supérfluos, milhar com ponto). String pura. */
export function formatDecimalString(value: string): string {
  const [int, frac = ''] = value.split('.')
  const trimmed = frac.replace(/0+$/, '')
  return maskQuantity(trimmed ? `${int},${trimmed}` : int)
}

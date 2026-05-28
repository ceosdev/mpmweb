/**
 * Mirrors backend/app/utils/tax_id.ts so the frontend can give immediate
 * feedback before submitting. The backend is still the authority.
 */

export function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  const digits = cpf.split('').map(Number)
  const check = (slice: number[], start: number) => {
    const sum = slice.reduce((acc, n, i) => acc + n * (start - i), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return check(digits.slice(0, 9), 10) === digits[9] && check(digits.slice(0, 10), 11) === digits[10]
}

export function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false

  const digits = cnpj.split('').map(Number)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const calc = (slice: number[], weights: number[]) => {
    const sum = slice.reduce((acc, n, i) => acc + n * weights[i], 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return calc(digits.slice(0, 12), weights1) === digits[12] && calc(digits.slice(0, 13), weights2) === digits[13]
}

export function isValidTaxId(value: string): boolean {
  if (value.length === 11) return isValidCpf(value)
  if (value.length === 14) return isValidCnpj(value)
  return false
}

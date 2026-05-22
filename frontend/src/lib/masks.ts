/**
 * Display masks for CPF / CNPJ / CEP / telefone.
 *
 * The DB and the API always speak the raw, digits-only value. The frontend is
 * the only place that masks it for the user — both in inputs (while typing)
 * and in read-only cells.
 */

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '')

export function maskCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function maskCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

/** Detects CPF (≤ 11 digits) vs CNPJ (> 11) and masks accordingly. */
export function maskTaxId(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = onlyDigits(raw)
  if (!d) return ''
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d)
}

export function maskPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

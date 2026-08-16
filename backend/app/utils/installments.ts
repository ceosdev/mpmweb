import { DateTime } from 'luxon'

/**
 * Splits an amount **in cents** into `count` installments.
 *
 * The first installments are equal and the **remainder goes to the last one**,
 * so the parts always add back up to exactly `baseCents` — splitting R$ 1.000,00
 * in 3 yields 333,33 + 333,33 + **333,34**, never 999,99.
 *
 * Works in integer cents on purpose: dividing reais as floats would leave the
 * sum off by fractions of a cent, and the payables would not match the invoice.
 *
 * `count < 1` throws instead of silently returning `[]` — an empty split would
 * let `ServiceEntryService.finalize` commit the entry as `finalized` with zero
 * titles generated. `count >= 1` is enforced here, not just trusted from the
 * caller; `baseCents >= count` (otherwise an installment would be R$ 0,00) is
 * still `ServiceEntryService.finalize`'s job, and it answers 422 for that case.
 */
export function splitInstallments(baseCents: number, count: number): number[] {
  if (count < 1) {
    throw new Error(`splitInstallments: count precisa ser >= 1 (recebeu ${count}).`)
  }

  const base = Math.trunc(baseCents)
  const per = Math.floor(base / count)
  const remainder = base - per * count

  const parts = Array.from({ length: count }, () => per)
  parts[count - 1] += remainder
  return parts
}

/**
 * Due date of each installment: the **same day of each following month**, not
 * "+30 days" — 30 days would drag the due date backwards through the calendar
 * (05/10 + 30 = 04/11) instead of holding the agreed day.
 *
 * Luxon clamps a day that does not exist in the target month, so 31/01 + 1 month
 * is 28/02 (or 29/02 on a leap year).
 */
export function installmentDueDates(firstDue: DateTime, count: number): DateTime[] {
  return Array.from({ length: count }, (_, index) => firstDue.plus({ months: index }))
}

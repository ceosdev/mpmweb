import type { Customer } from '@/types/api'

/** Nome exibido do cliente nos headers: nome fantasia, senão razão social/nome. */
export function customerDisplayName(customer: Pick<Customer, 'legalName' | 'tradeName'>): string {
  return customer.tradeName?.trim() || customer.legalName
}

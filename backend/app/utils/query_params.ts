import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { BusinessException } from '#exceptions/app_exception'

type Request = HttpContext['request']

/**
 * Query-string readers for list filters. An absent or empty param means "no
 * filter"; a present but malformed one is rejected with 422 — never passed on
 * as `NaN`, a fraction or a string Postgres cannot cast, which would end in a
 * 500. The message names the field as the screen shows it.
 */

const LABELS: Record<string, string> = {
  id: 'Código',
  page: 'Página',
  perPage: 'Itens por página',
  supplierId: 'Fornecedor',
  customerId: 'Cliente',
  productGroupId: 'Grupo de produto',
}

function label(key: string): string {
  return Object.hasOwn(LABELS, key) ? LABELS[key] : key
}

function readRaw(request: Request, key: string): string | undefined {
  const raw = request.input(key)
  if (raw === undefined || raw === null || raw === '') return undefined
  return String(raw).trim()
}

/**
 * Integer filter (`?id=`, `?supplierId=`…). Zero or negative is accepted — it
 * simply matches nothing, as before; only a non-integer is rejected.
 */
export function queryInt(request: Request, key: string): number | undefined {
  const value = readRaw(request, key)
  if (value === undefined) return undefined

  if (!/^-?\d{1,9}$/.test(value)) {
    throw new BusinessException(`Valor inválido para ${label(key)}: informe um número inteiro.`)
  }
  return Number(value)
}

/** Pagination (`?page=`, `?perPage=`): a positive integer. */
export function queryPositiveInt(request: Request, key: string): number | undefined {
  const value = readRaw(request, key)
  if (value === undefined) return undefined

  if (!/^\d{1,9}$/.test(value) || Number(value) < 1) {
    throw new BusinessException(
      `Valor inválido para ${label(key)}: informe um número inteiro positivo.`
    )
  }
  return Number(value)
}

/** Calendar date as `YYYY-MM-DD` (`?dueFrom=`, `?operationTo=`…). */
export function queryDate(request: Request, key: string): string | undefined {
  const value = readRaw(request, key)
  if (value === undefined) return undefined

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !DateTime.fromISO(value).isValid) {
    throw new BusinessException('Data inválida no filtro: use o formato AAAA-MM-DD.')
  }
  return value
}

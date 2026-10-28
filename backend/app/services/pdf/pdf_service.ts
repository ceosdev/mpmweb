import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { DateTime } from 'luxon'
import pdfmake from 'pdfmake'
import type { Content } from 'pdfmake'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type Company from '#models/company'
import { APP_TIME_ZONE } from '#utils/dates'
import { LOGO_DISK, logoKeyFromPath } from '#utils/company_logo'
import { fromScaled, toScaled, QTY_SCALE } from '#utils/decimal'

// Roboto TTFs bundled with pdfmake 0.3.
const require = createRequire(import.meta.url)
pdfmake.addFonts(require('pdfmake/fonts/Roboto.js'))
// Documents are fully generated server-side: never fetch URLs.
pdfmake.setUrlAccessPolicy(() => false)
// Local files: only the bundled fonts directory.
const FONTS_DIR = dirname(require.resolve('pdfmake/fonts/Roboto.js'))
pdfmake.setLocalAccessPolicy((path) => path.startsWith(FONTS_DIR))

/** `pdfmake/interfaces` is not resolvable under this tsconfig; derive the type instead. */
type Column = Content & { width?: number | string }
export type TDocumentDefinitions = Parameters<typeof pdfmake.createPdf>[0]

const LOGO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** Renders a pdfmake document definition into a PDF `Buffer`. */
export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  const base: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    footer: (currentPage, pageCount) => ({
      text: `Pág. ${currentPage} de ${pageCount}`,
      alignment: 'right',
      fontSize: 8,
      color: '#666666',
      margin: [40, 16, 40, 0],
    }),
    ...doc,
  }
  return pdfmake.createPdf(base).getBuffer()
}

/** `'1.2500'` → `'1,25'`, `'2.0000'` → `'2'`. Decimal-safe (no `Number`). */
export function formatQuantityPtBr(value: string): string {
  const [int, frac = ''] = fromScaled(toScaled(value, QTY_SCALE), QTY_SCALE).split('.')
  const trimmed = frac.replace(/0+$/, '')
  return trimmed ? `${int},${trimmed}` : int
}

/** `'2026-10-27'` (or a full ISO string) → `'27/10/2026'`. */
export function formatDatePtBr(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** UTC/offset ISO timestamp → `dd/MM/yyyy` in the application's timezone. */
export function formatDateTimeZonedPtBr(iso: string): string {
  const date = DateTime.fromISO(iso, { setZone: true }).setZone(APP_TIME_ZONE).toISODate()
  return formatDatePtBr(date ?? iso)
}

/** Current date and time in the application's timezone, as `dd/MM/yyyy HH:mm`. */
export function nowPtBr(): string {
  return DateTime.now().setZone(APP_TIME_ZONE).toFormat('dd/MM/yyyy HH:mm')
}

function formatTaxId(value: string): string {
  const d = value.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return value
}

function formatZipCode(value: string): string {
  const d = value.replace(/\D/g, '')
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : value
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return value
}

/** Reads the company logo as a data URI; `null` when absent, unsupported or unreadable. */
async function loadLogo(company: Company): Promise<string | null> {
  const key = logoKeyFromPath(company.logoPath)
  if (!key) return null
  const mime = LOGO_MIME[key.split('.').pop()?.toLowerCase() ?? '']
  if (!mime) return null
  try {
    const bytes = await drive.use(LOGO_DISK).getBytes(key)
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  } catch (error) {
    logger.warn({ err: error, companyId: company.id }, 'Falha ao ler o logo da empresa para o PDF')
    return null
  }
}

/**
 * Reusable company header: logo (when available), legal name, address, contacts
 * and tax data on the left; issue date/time on the right.
 */
export async function companyHeader(company: Company): Promise<Content> {
  const logo = await loadLogo(company)

  const street = [company.address, company.addressNumber].filter(Boolean).join(', ')
  const addressLine = [
    street,
    company.neighborhood,
    company.zipCode ? `CEP ${formatZipCode(company.zipCode)}` : null,
    [company.city, company.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(' - ')
  const contactLine = [
    company.phone ? `Tel. ${formatPhone(company.phone)}` : null,
    company.email,
  ]
    .filter(Boolean)
    .join('  |  ')
  const registrationLine = [
    company.taxId ? `CNPJ ${formatTaxId(company.taxId)}` : null,
    company.municipalRegistration ? `IM ${company.municipalRegistration}` : null,
  ]
    .filter(Boolean)
    .join('  |  ')

  const lines: Content[] = [{ text: company.legalName, bold: true, fontSize: 12 }]
  for (const line of [addressLine, contactLine, registrationLine]) {
    if (line) lines.push({ text: line, fontSize: 8.5, color: '#444444' })
  }

  const columns: Column[] = []
  if (logo) columns.push({ image: logo, fit: [70, 56], width: 70 })
  columns.push({ stack: lines, width: '*' })
  columns.push({
    text: `Emitido em ${nowPtBr()}`,
    alignment: 'right',
    fontSize: 8,
    color: '#666666',
    width: 'auto',
  })

  return {
    stack: [
      { columns, columnGap: 10 },
      {
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.7, lineColor: '#999999' }],
        margin: [0, 0, 0, 10],
      },
    ],
  }
}

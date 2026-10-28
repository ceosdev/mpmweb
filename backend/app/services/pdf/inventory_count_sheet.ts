import type { Content } from 'pdfmake'
import type Company from '#models/company'
import type inventoryService from '#services/inventory_service'
import {
  companyHeader,
  type TDocumentDefinitions,
  formatDatePtBr,
  formatDateTimeZonedPtBr,
  formatQuantityPtBr,
} from '#services/pdf/pdf_service'

type ShownInventory = Awaited<ReturnType<typeof inventoryService.show>>

const STATUS_LABELS: Record<string, string> = { open: 'Aberto', closed: 'Fechado' }

/** Same text as the on-screen notice of the count page. */
export const TOOLS_NOTICE =
  'Conte só as ferramentas que estão na prateleira. As emprestadas a funcionários já saíram do estoque e voltam a somar quando forem devolvidas.'

type TextCell = { text: string; alignment?: 'right'; color?: string; bold?: boolean }

const DIVERGENT_FILL = '#fde2e2'

function field(label: string, value: string): Content {
  return { text: [{ text: `${label}: `, bold: true }, value], margin: [0, 1, 0, 1] }
}

function signed(difference: string): string {
  const text = formatQuantityPtBr(difference)
  return difference.startsWith('-') || text === '0' ? text : `+${text}`
}

/**
 * Count sheet of an inventory. Blind (no system balance) unless `reveal`;
 * the caller forces `reveal` for closed inventories.
 */
export async function buildInventoryCountSheet(
  inventory: ShownInventory,
  company: Company,
  reveal: boolean
): Promise<TDocumentDefinitions> {
  const right = (text: string, extra: Partial<TextCell> = {}): TextCell => ({ text, alignment: 'right' as const, ...extra })

  const header: Content[] = [
    { text: 'Código', bold: true },
    { text: 'Descrição', bold: true },
    { text: 'Un.', bold: true },
    ...(reveal ? [right('Qtd. estoque', { bold: true })] : []),
    right('Qtd. contada', { bold: true }),
    ...(reveal ? [right('Diferença', { bold: true })] : []),
  ]

  let divergent = 0
  const rows: Content[][] = inventory.items.map((item) => {
    const isDivergent = item.state === 'divergent'
    if (isDivergent) divergent++
    const fillColor = reveal && isDivergent ? DIVERGENT_FILL : undefined
    const counted =
      item.countedQuantity === null
        ? right('_________', { color: '#888888' })
        : right(formatQuantityPtBr(item.countedQuantity))
    const cells: TextCell[] = [
      { text: String(item.productId) },
      { text: item.productDescription },
      { text: item.unitOfMeasure ?? '' },
    ]
    if (reveal) {
      cells.push(
        right('stockQuantity' in item && item.stockQuantity ? formatQuantityPtBr(item.stockQuantity) : '')
      )
    }
    cells.push(counted)
    if (reveal) {
      cells.push(
        right('difference' in item && item.difference !== null ? signed(item.difference) : '—')
      )
    }
    return fillColor ? cells.map((c) => ({ ...c, fillColor })) : cells
  })

  const counted = inventory.countedCount
  const totals = [
    `Itens: ${inventory.itemCount}`,
    `Contados: ${counted}`,
    `Não contados: ${inventory.itemCount - counted}`,
    ...(reveal ? [`Divergentes: ${divergent}`] : []),
  ].join('   |   ')

  const content: Content[] = [
    await companyHeader(company),
    { text: 'Relatório de Contagem de Inventário', fontSize: 15, bold: true, margin: [0, 0, 0, 8] },
  ]
  if (inventory.hasTools) {
    content.push({ text: TOOLS_NOTICE, italics: true, fontSize: 9, margin: [0, 0, 0, 6] })
  }
  content.push(
    field('Nº do inventário', String(inventory.id).padStart(10, '0')),
    field('Data de abertura', formatDatePtBr(inventory.openingDate!)),
    field('Status', STATUS_LABELS[inventory.status] ?? inventory.status),
    field(
      'Abrangência',
      inventory.groups.length === 0
        ? 'Todos os grupos'
        : inventory.groups.map((group) => group.description).join(', ')
    ),
    field('Aberto por', inventory.openedByName ?? '')
  )
  if (inventory.status === 'closed') {
    if (inventory.closedAt) content.push(field('Data de fechamento', formatDateTimeZonedPtBr(inventory.closedAt)))
    content.push(field('Fechado por', inventory.closedByName ?? ''))
  }

  content.push(
    {
      margin: [0, 12, 0, 0],
      table: {
        headerRows: 1,
        widths: reveal ? [40, '*', 40, 65, 65, 60] : [50, '*', 50, 90],
        body: [header, ...rows],
      },
      layout: 'lightHorizontalLines',
    },
    { text: totals, bold: true, margin: [0, 10, 0, 0] }
  )

  return { info: { title: `Contagem de inventário ${inventory.id}` }, content }
}

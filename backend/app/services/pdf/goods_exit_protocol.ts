import type { Content } from 'pdfmake'
import type Company from '#models/company'
import type goodsExitService from '#services/goods_exit_service'
import {
  companyHeader,
  type TDocumentDefinitions,
  formatDatePtBr,
  formatQuantityPtBr,
} from '#services/pdf/pdf_service'

type SerializedGoodsExit = ReturnType<typeof goodsExitService.serialize>

const EXIT_TYPE_LABELS: Record<string, string> = { normal: 'Normal', tool: 'Ferramenta' }
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  finalized: 'Finalizada',
  delivered: 'Entregue',
  returned: 'Devolvida',
}

function field(label: string, value: string): Content {
  return { text: [{ text: `${label}: `, bold: true }, value], margin: [0, 1, 0, 1] }
}

/** Protocol document of a goods exit (a movement receipt: no barcodes, no money). */
export async function buildGoodsExitProtocol(
  exit: SerializedGoodsExit,
  company: Company
): Promise<TDocumentDefinitions> {
  const isTool = exit.exitType === 'tool'
  const consumer = [exit.consumerName, exit.assetCode].filter(Boolean).join(' – ')

  const header: Content[] = [
    { text: 'Código', bold: true },
    { text: 'Produto', bold: true },
    ...(isTool
      ? [{ text: 'Qtd.', bold: true, alignment: 'right' as const }]
      : [
          { text: 'Qtd. requisitada', bold: true, alignment: 'right' as const },
          { text: 'Qtd. consumida', bold: true, alignment: 'right' as const },
        ]),
  ]

  const rows: Content[][] = (exit.items ?? []).map((item) => [
    String(item.productId),
    item.productDescription ?? '',
    { text: formatQuantityPtBr(item.requestedQuantity), alignment: 'right' as const },
    ...(isTool
      ? []
      : [
          {
            text: item.consumedQuantity === null ? '-' : formatQuantityPtBr(item.consumedQuantity),
            alignment: 'right' as const,
          },
        ]),
  ])

  const content: Content[] = [
    await companyHeader(company),
    { text: 'Protocolo de Saída de Mercadoria', fontSize: 15, bold: true, margin: [0, 0, 0, 8] },
    field('Nº da saída', String(exit.id).padStart(10, '0')),
    field('Tipo de saída', EXIT_TYPE_LABELS[exit.exitType] ?? exit.exitType),
    field('Status', STATUS_LABELS[exit.status] ?? exit.status),
    field('Data da operação', formatDatePtBr(exit.operationDate!)),
    field('Solicitante', exit.requestedByName ?? ''),
    field(exit.consumerLabel.toUpperCase(), consumer),
  ]
  if (exit.notes) content.push(field('Observação', exit.notes))

  content.push({
    margin: [0, 12, 0, 0],
    table: {
      headerRows: 1,
      widths: isTool ? [60, '*', 80] : [60, '*', 90, 90],
      body: [header, ...rows],
    },
    layout: 'lightHorizontalLines',
  })

  return { info: { title: `Protocolo de saída ${exit.id}` }, content }
}

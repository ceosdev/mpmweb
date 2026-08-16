import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { servicesApi } from '@/services/services-api'
import { useAuth } from '@/providers/auth-provider'
import { formatCurrency, maskMoney, reaisToCents } from '@/lib/masks'
import { MaskedInput } from '@/components/form/masked-input'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Um item do array `items` do form pai. Os campos monetários seguem o padrão
 * do projeto: string de **centavos**, convertida com `centsToReais` no
 * submit. `serviceDescription` é capturada no momento em que a linha é
 * adicionada — a tabela exibe texto estático, não reabre o `Select`.
 */
export interface ServiceEntryItemFormValue {
  serviceId: number
  serviceDescription: string
  /** Inteiro, ≥ 1. */
  quantity: number
  /** Centavos, string de dígitos. */
  unitPrice: string
  /** Centavos, string de dígitos. */
  discount: string
}

/** O que este sub-form precisa do form pai — só o campo `items`. */
interface FormValuesWithItems {
  items: ServiceEntryItemFormValue[]
}

export interface ServiceEntryItemsSectionProps {
  /** Campos do array `items` do formulário pai (RHF `useFieldArray`). */
  name: 'items'
  readOnly?: boolean
}

function lineTotalCents(item: Pick<ServiceEntryItemFormValue, 'quantity' | 'unitPrice' | 'discount'>): number {
  return item.quantity * Number(item.unitPrice || '0') - Number(item.discount || '0')
}

/**
 * Sub-form dos serviços da nota: uma linha de entrada (serviço, qtd., valor,
 * desconto) acima de uma tabela com os itens já adicionados. Tudo calculado
 * em **centavos**, nunca somando reais em ponto flutuante.
 */
export function ServiceEntryItemsSection({ name, readOnly = false }: ServiceEntryItemsSectionProps) {
  const { control } = useFormContext<FormValuesWithItems>()
  const { fields, append, remove } = useFieldArray({ control, name })

  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const [draftServiceId, setDraftServiceId] = useState('')
  const [draftQuantity, setDraftQuantity] = useState('1')
  const [draftUnitPrice, setDraftUnitPrice] = useState('')
  const [draftDiscount, setDraftDiscount] = useState('')

  // Só serviços de **terceiro**: a entrada de serviço documenta a nota de um
  // fornecedor, então serviço interno (executado pela própria empresa) não entra
  // aqui. O filtro é do servidor — `type` já é parâmetro de `GET /services`.
  const servicesQuery = useQuery({
    queryKey: ['services', companyId, 'options', 'third_party'],
    queryFn: () =>
      servicesApi.list({
        page: 1,
        perPage: 200,
        sort: 'description',
        order: 'asc',
        type: 'third_party',
      }),
    enabled: !readOnly,
  })

  // O backend rejeita serviço inativo no create — a UI não pode oferecer.
  const activeServices = useMemo(
    () => (servicesQuery.data?.data ?? []).filter((service) => service.isActive),
    [servicesQuery.data]
  )

  const totalCents = useMemo(
    () => fields.reduce((sum, item) => sum + lineTotalCents(item), 0),
    [fields]
  )

  function handleServiceChange(value: string) {
    setDraftServiceId(value)
    // Conveniência: sugere o valor cadastrado do serviço; o usuário pode sobrescrever.
    const service = activeServices.find((candidate) => String(candidate.id) === value)
    if (service?.suggestedValue != null) {
      setDraftUnitPrice(reaisToCents(service.suggestedValue))
    } else {
      // Sem valor sugerido para o novo serviço — limpa, senão o campo continua
      // mostrando o preço do serviço anterior.
      setDraftUnitPrice('')
    }
  }

  function handleAdd() {
    const serviceId = Number(draftServiceId)
    const service = activeServices.find((candidate) => candidate.id === serviceId)
    if (!draftServiceId || !service) {
      toast.error('Selecione um serviço.')
      return
    }

    const quantity = Number(draftQuantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error('A quantidade deve ser um número inteiro maior ou igual a 1.')
      return
    }

    const unitPriceCents = Number(draftUnitPrice || '0')
    if (unitPriceCents <= 0) {
      toast.error('Informe o valor do serviço.')
      return
    }

    const discountCents = Number(draftDiscount || '0')
    if (discountCents > quantity * unitPriceCents) {
      toast.error('O desconto não pode ser maior que o valor total do serviço.')
      return
    }

    append({
      serviceId,
      serviceDescription: service.description,
      quantity,
      unitPrice: draftUnitPrice,
      discount: draftDiscount || '0',
    })

    setDraftServiceId('')
    setDraftQuantity('1')
    setDraftUnitPrice('')
    setDraftDiscount('')
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        // Alinhamento pelo TOPO, não pelo fim: todos os campos têm rótulo de
        // mesma altura (`Label` é `leading-none`) e o mesmo `space-y-1.5`, então
        // `items-start` põe rótulos e controles exatamente na mesma linha. Com
        // `items-end`, qualquer diferença de altura entre o `SelectTrigger` e o
        // `Input` empurrava só o rótulo do Serviço para cima.
        <div className="grid gap-3 md:grid-cols-12 md:items-start">
          <div className="space-y-1.5 md:col-span-5">
            <Label htmlFor="itemServiceId" className="text-sm">
              Serviço
            </Label>
            <Select value={draftServiceId} onValueChange={handleServiceChange}>
              <SelectTrigger id="itemServiceId" className="h-9 w-full">
                <SelectValue
                  placeholder={servicesQuery.isLoading ? 'Carregando…' : 'Selecione'}
                />
              </SelectTrigger>
              <SelectContent>
                {activeServices.map((service) => (
                  <SelectItem key={service.id} value={String(service.id)}>
                    {service.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="itemQuantity" className="text-sm">
              Qtd.
            </Label>
            <Input
              id="itemQuantity"
              type="number"
              min={1}
              step={1}
              value={draftQuantity}
              onChange={(event) => setDraftQuantity(event.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="itemUnitPrice" className="text-sm">
              Valor
            </Label>
            <MaskedInput
              id="itemUnitPrice"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={draftUnitPrice}
              onChange={setDraftUnitPrice}
              mask={maskMoney}
              maxDigits={12}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="itemDiscount" className="text-sm">
              Desconto
            </Label>
            <MaskedInput
              id="itemDiscount"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={draftDiscount}
              onChange={setDraftDiscount}
              mask={maskMoney}
              maxDigits={12}
            />
          </div>

          <div className="space-y-1.5 md:col-span-1">
            {/*
              Rótulo invisível: reserva exatamente a mesma altura dos rótulos
              dos outros campos, para o botão cair na linha dos controles sem
              número mágico. Se o estilo do `Label` mudar, este acompanha.
            */}
            <Label aria-hidden className="invisible text-sm">
              Adicionar
            </Label>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleAdd}
              aria-label="Adicionar serviço"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum serviço adicionado." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. serviço</TableHead>
                  <TableHead>Descrição do serviço</TableHead>
                  <TableHead className="text-right">Qtd. lançada</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  {!readOnly && <TableHead className="w-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.serviceId}</TableCell>
                    <TableCell>{field.serviceDescription}</TableCell>
                    <TableCell className="text-right">{field.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(field.unitPrice || '0') / 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(field.discount || '0') / 100)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lineTotalCents(field) / 100)}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => remove(index)}
                          aria-label={`Remover ${field.serviceDescription}`}
                        >
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Quantidade de serviços:{' '}
              <span className="font-medium text-foreground">{fields.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total dos serviços</span>
              <span className="font-medium">{formatCurrency(totalCents / 100)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import {
  receivableSettlementsApi,
  type CreateReceivableSettlementPayload,
  type UpdateReceivableSettlementPayload,
} from '@/services/receivable-settlements-api'
import { receivablesApi } from '@/services/receivables-api'
import { paymentTypesApi } from '@/services/payment-types-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, maskMoney } from '@/lib/masks'
import { formatIsoDate, todayIso } from '@/lib/format'
import type { Receivable, ReceivableSettlement } from '@/types/api'
import { ReceivableStatusBadge } from '@/modules/receivables/receivable-status-badge'
import { MaskedInput } from '@/components/form/masked-input'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ReceivableSettlementsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A linha do grid; usada para o cabeçalho e o id do título. */
  receivable: Receivable | null
}

/**
 * Baixas (recebimentos) de um título — CRUD aberto a partir do grid de contas a
 * receber. Abre na **listagem**; "Nova baixa" troca a mesma janela para o
 * formulário. Toda baixa atualiza o saldo/status do título — o backend recalcula,
 * e aqui só revalidamos as queries. Ver `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export function ReceivableSettlementsDialog({
  open,
  onOpenChange,
  receivable,
}: ReceivableSettlementsDialogProps) {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId
  const receivableId = receivable?.id ?? null

  const [view, setView] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<ReceivableSettlement | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Ao (re)abrir, sempre começa na listagem.
  useEffect(() => {
    if (open) {
      setView('list')
      setEditing(null)
      setDeleteId(null)
    }
  }, [open])

  // Cabeçalho ao vivo: o saldo/status mudam a cada baixa. Parte da linha do grid
  // (initialData) e refetcha o título para refletir o recálculo do backend.
  const detailQuery = useQuery({
    queryKey: ['receivables', companyId, 'detail', receivableId],
    queryFn: () => receivablesApi.get(receivableId as number),
    enabled: open && receivableId !== null,
    initialData: receivable ?? undefined,
  })
  const current = detailQuery.data ?? receivable

  const listQuery = useQuery({
    queryKey: ['receivable-settlements', companyId, receivableId],
    queryFn: () => receivableSettlementsApi.list(receivableId as number),
    enabled: open && receivableId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      receivableSettlementsApi.remove(receivableId as number, id),
    onSuccess: () => {
      toast.success('Baixa removida.')
      invalidate()
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function invalidate() {
    // Uma invalidação em 'receivables' cobre a lista do grid E o detalhe do título.
    queryClient.invalidateQueries({ queryKey: ['receivables'] })
    queryClient.invalidateQueries({
      queryKey: ['receivable-settlements', companyId, receivableId],
    })
  }

  function openCreate() {
    setEditing(null)
    setView('form')
  }
  function openEdit(row: ReceivableSettlement) {
    setEditing(row)
    setView('form')
  }
  function backToList() {
    setView('list')
    setEditing(null)
  }

  const rows = listQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle>
              {view === 'form'
                ? editing
                  ? 'Editar baixa'
                  : 'Nova baixa'
                : 'Baixas do título'}
            </DialogTitle>
            {current && <ReceivableStatusBadge status={current.status} />}
          </div>
        </DialogHeader>

        {current && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm sm:grid-cols-4">
            <HeaderItem label="Título">
              {current.documentNumber}/{current.installment}
            </HeaderItem>
            <HeaderItem label="Cliente">{current.customerName || '—'}</HeaderItem>
            <HeaderItem label="Total">{formatCurrency(current.total)}</HeaderItem>
            <HeaderItem label="Recebido">{formatCurrency(current.paidAmount)}</HeaderItem>
            <HeaderItem label="Saldo">
              <span className="font-semibold">{formatCurrency(current.balance)}</span>
            </HeaderItem>
          </div>
        )}

        {view === 'form' && current ? (
          <SettlementForm
            receivable={current}
            settlement={editing}
            onCancel={backToList}
            onSaved={() => {
              invalidate()
              backToList()
            }}
          />
        ) : (
          <>
            {listQuery.isLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhuma baixa lançada"
                description="Registre o primeiro recebimento deste título."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo de pagamento</TableHead>
                    <TableHead>Nº documento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="w-0 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatIsoDate(row.settlementDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.paymentTypeName || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.documentNumber || '—'}
                      </TableCell>
                      <TableCell>{formatCurrency(row.amount)}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {row.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Can permission="receivable_settlements.edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(row)}
                              aria-label="Editar"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </Can>
                          <Can permission="receivable_settlements.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(row.id)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Can permission="receivable_settlements.create">
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Nova baixa
                </Button>
              </Can>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteId(null)}
        title="Excluir baixa"
        description="O saldo do título será recalculado. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </Dialog>
  )
}

function HeaderItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

/** Centavos ("12345") → reais (123.45). Vazio → 0. */
function centsToReais(cents: string): number {
  if (!cents) return 0
  return Number(cents) / 100
}

/** Reais (123.45) → centavos ("12345"), para o form. */
function reaisToCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(Math.round(value * 100))
}

const formSchema = z.object({
  settlementDate: z.string().min(1, 'Data da baixa é obrigatória.'),
  paymentTypeId: z.string().min(1, 'Selecione o tipo de pagamento.'),
  /** Centavos crus. */
  amount: z.string().min(1, 'Valor recebido é obrigatório.'),
  documentNumber: z
    .string()
    .trim()
    .max(30, 'Deve ter no máximo 30 caracteres.')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'Deve ter no máximo 1000 caracteres.')
    .optional()
    .or(z.literal('')),
})

type SettlementFormValues = z.infer<typeof formSchema>

interface SettlementFormProps {
  receivable: Receivable
  settlement: ReceivableSettlement | null
  onCancel: () => void
  onSaved: () => void
}

/**
 * Formulário de baixa, renderizado dentro do mesmo modal (troca de "view").
 * Valor recebido já vem preenchido com o **saldo restante** — o caso mais comum é
 * o recebimento total.
 */
function SettlementForm({ receivable, settlement, onCancel, onSaved }: SettlementFormProps) {
  const isEdit = Boolean(settlement)
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const form = useForm<SettlementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      settlementDate: settlement?.settlementDate ?? todayIso(),
      paymentTypeId: settlement ? String(settlement.paymentTypeId) : '',
      // Default = saldo restante (recebimento total num clique); na edição, o valor da baixa.
      amount: reaisToCents(settlement ? settlement.amount : receivable.balance),
      documentNumber: settlement?.documentNumber ?? '',
      notes: settlement?.notes ?? '',
    },
  })

  const paymentTypesQuery = useQuery({
    queryKey: ['payment-types', companyId, 'options'],
    queryFn: () =>
      paymentTypesApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  })

  // Tipos ativos; na edição, mantém o tipo já vinculado mesmo se ficou inativo.
  const paymentTypeOptions = useMemo(() => {
    const all = paymentTypesQuery.data?.data ?? []
    const active = all.filter((type) => type.isActive)
    if (settlement && !active.some((type) => type.id === settlement.paymentTypeId)) {
      const current = all.find((type) => type.id === settlement.paymentTypeId)
      if (current) return [current, ...active]
    }
    return active
  }, [paymentTypesQuery.data, settlement])

  const mutation = useMutation({
    mutationFn: (values: SettlementFormValues) => {
      const payload: CreateReceivableSettlementPayload = {
        settlementDate: values.settlementDate,
        paymentTypeId: Number(values.paymentTypeId),
        amount: centsToReais(values.amount),
        documentNumber: values.documentNumber?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      }
      if (isEdit && settlement) {
        return receivableSettlementsApi.update(
          receivable.id,
          settlement.id,
          payload satisfies UpdateReceivableSettlementPayload
        )
      }
      return receivableSettlementsApi.create(receivable.id, payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Baixa atualizada.' : 'Baixa lançada.')
      onSaved()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Data da baixa"
          htmlFor="settlementDate"
          error={form.formState.errors.settlementDate?.message}
        >
          <Input id="settlementDate" type="date" {...form.register('settlementDate')} />
        </Field>

        <Field
          label="Tipo de pagamento"
          htmlFor="paymentTypeId"
          error={form.formState.errors.paymentTypeId?.message}
        >
          <Controller
            control={form.control}
            name="paymentTypeId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="paymentTypeId" className="w-full">
                  <SelectValue
                    placeholder={paymentTypesQuery.isLoading ? 'Carregando…' : 'Selecione'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypeOptions.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.description}
                      {!type.isActive ? ' (inativo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          label="Valor recebido"
          htmlFor="amount"
          error={form.formState.errors.amount?.message}
        >
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <MaskedInput
                id="amount"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={field.value}
                onChange={field.onChange}
                mask={maskMoney}
                maxDigits={12}
              />
            )}
          />
        </Field>

        <Field
          label="Número do documento"
          htmlFor="documentNumber"
          error={form.formState.errors.documentNumber?.message}
          hint="Apenas para cheque"
        >
          <Input id="documentNumber" maxLength={30} {...form.register('documentNumber')} />
        </Field>

        <Field
          label="Observação"
          htmlFor="notes"
          error={form.formState.errors.notes?.message}
          className="md:col-span-2"
        >
          <Textarea id="notes" rows={2} {...form.register('notes')} />
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-sm">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

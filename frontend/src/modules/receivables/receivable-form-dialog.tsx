import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  receivablesApi,
  type CreateReceivablePayload,
  type UpdateReceivablePayload,
} from '@/services/receivables-api'
import { getErrorMessage } from '@/lib/errors'
import { centsToReais, formatCurrency, maskMoney, reaisToCents } from '@/lib/masks'
import { todayIso } from '@/lib/format'
import type { Receivable } from '@/types/api'
import { EntityPicker } from '@/components/common/entity-picker'
import { ReceivableStatusBadge } from '@/modules/receivables/receivable-status-badge'
import { MaskedInput } from '@/components/form/masked-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Não há campo de status: ele é **resultado** (das baixas e do cancelamento),
 * nunca escolha. Espelha o form de contas a pagar, com o cliente no lugar do
 * fornecedor. Ver `docs/spec/financeiro/004-contas-a-receber.md`.
 *
 * Os 4 campos monetários seguem o padrão do projeto: o form guarda **centavos**
 * como string de dígitos ("12345" = R$ 123,45) e a máscara cuida da exibição.
 */
const schema = z.object({
  documentNumber: z
    .string()
    .trim()
    .min(1, 'Número do título é obrigatório.')
    .max(20, 'Deve ter no máximo 20 caracteres.'),
  installment: z
    .number({ error: 'Ordem é obrigatória.' })
    .int('Ordem deve ser um número inteiro.')
    .min(1, 'Ordem deve ser no mínimo 1.')
    .max(999, 'Ordem deve ser no máximo 999.'),
  customerId: z
    .number({ error: 'Selecione um cliente.' })
    .int()
    .positive('Selecione um cliente.'),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória.'),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória.'),
  /** Centavos crus. Vazio = sem valor. */
  amount: z.string().min(1, 'Valor do título é obrigatório.'),
  discount: z.string(),
  fine: z.string(),
  interest: z.string(),
  notes: z.string().trim().max(1000, 'Deve ter no máximo 1000 caracteres.').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  const today = todayIso()
  return {
    documentNumber: '',
    installment: 1,
    customerId: 0,
    // Emissão e vencimento já vêm com a data de hoje.
    issueDate: today,
    dueDate: today,
    amount: '',
    discount: '',
    fine: '',
    interest: '',
    notes: '',
  }
}

function toFormValues(receivable: Receivable): FormValues {
  return {
    documentNumber: receivable.documentNumber,
    installment: receivable.installment,
    customerId: receivable.customerId,
    issueDate: receivable.issueDate,
    dueDate: receivable.dueDate,
    amount: reaisToCents(receivable.amount),
    discount: reaisToCents(receivable.discount),
    fine: reaisToCents(receivable.fine),
    interest: reaisToCents(receivable.interest),
    notes: receivable.notes ?? '',
  }
}

function toPayload(values: FormValues): CreateReceivablePayload {
  return {
    documentNumber: values.documentNumber,
    installment: values.installment,
    customerId: values.customerId,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    amount: centsToReais(values.amount),
    discount: centsToReais(values.discount),
    fine: centsToReais(values.fine),
    interest: centsToReais(values.interest),
    notes: values.notes || undefined,
  }
}

interface ReceivableFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: Receivable | null
  /** Somente-leitura: reusa o mesmo modal para "Visualizar", sem permitir edição. */
  readOnly?: boolean
}

export function ReceivableFormDialog({
  open,
  onOpenChange,
  receivable,
  readOnly = false,
}: ReceivableFormDialogProps) {
  const isEdit = Boolean(receivable)
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(receivable ? toFormValues(receivable) : emptyValues())
  }, [open, receivable, form])

  // Total e saldo ao vivo, conforme o usuário digita: é o feedback que pega erro
  // de digitação no valor antes de salvar.
  const amount = centsToReais(form.watch('amount'))
  const discount = centsToReais(form.watch('discount'))
  const fine = centsToReais(form.watch('fine'))
  const interest = centsToReais(form.watch('interest'))
  const total = amount - discount + fine + interest
  const paidAmount = receivable?.paidAmount ?? 0
  const balance = Math.max(0, total - paidAmount)

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && receivable) {
        return receivablesApi.update(receivable.id, payload satisfies UpdateReceivablePayload)
      }
      return receivablesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Título atualizado.' : 'Título lançado.')
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>
              {readOnly ? 'Visualizar título' : isEdit ? 'Editar título' : 'Novo título'}
            </DialogTitle>
            {/* Status é read-only — resultado, nunca escolha. */}
            {receivable && <ReceivableStatusBadge status={receivable.status} />}
          </div>
        </DialogHeader>

        <form
          id="receivable-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-6">
            <Field
              label="Número do título"
              htmlFor="documentNumber"
              error={form.formState.errors.documentNumber?.message}
              className="md:col-span-2"
            >
              <Input
                id="documentNumber"
                maxLength={20}
                disabled={readOnly}
                {...form.register('documentNumber')}
              />
            </Field>

            <Field
              label="Ordem"
              htmlFor="installment"
              error={form.formState.errors.installment?.message}
              className="md:col-span-1"
            >
              <Input
                id="installment"
                type="number"
                min={1}
                max={999}
                disabled={readOnly}
                {...form.register('installment', { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Cliente"
              htmlFor="customerId"
              error={form.formState.errors.customerId?.message}
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <EntityPicker
                    id="customerId"
                    source="customer"
                    // 0 é o "vazio" do form; o picker fala em number | null.
                    value={field.value ? field.value : null}
                    onChange={(value) => field.onChange(value ?? 0)}
                    invalid={Boolean(form.formState.errors.customerId)}
                    disabled={readOnly}
                  />
                )}
              />
            </Field>

            <Field
              label="Data de emissão"
              htmlFor="issueDate"
              error={form.formState.errors.issueDate?.message}
              className="md:col-span-3"
            >
              <Input id="issueDate" type="date" disabled={readOnly} {...form.register('issueDate')} />
            </Field>

            <Field
              label="Data de vencimento"
              htmlFor="dueDate"
              error={form.formState.errors.dueDate?.message}
              className="md:col-span-3"
            >
              <Input id="dueDate" type="date" disabled={readOnly} {...form.register('dueDate')} />
            </Field>

            <MoneyField
              control={form.control}
              name="amount"
              label="Valor do título"
              error={form.formState.errors.amount?.message}
              disabled={readOnly}
            />
            <MoneyField
              control={form.control}
              name="discount"
              label="Desconto"
              error={form.formState.errors.discount?.message}
              disabled={readOnly}
            />
            <MoneyField
              control={form.control}
              name="fine"
              label="Multa"
              error={form.formState.errors.fine?.message}
              disabled={readOnly}
            />
            <MoneyField
              control={form.control}
              name="interest"
              label="Juros"
              error={form.formState.errors.interest?.message}
              disabled={readOnly}
            />

            <Field
              label="Observação"
              htmlFor="notes"
              error={form.formState.errors.notes?.message}
              className="md:col-span-6"
            >
              <Textarea id="notes" rows={3} disabled={readOnly} {...form.register('notes')} />
            </Field>
          </div>
        </form>

        <div className="flex items-center justify-end gap-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatCurrency(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Saldo</span>
            <span className="font-medium">{formatCurrency(balance)}</span>
          </div>
        </div>

        <DialogFooter>
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" form="receivable-form" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Campo monetário: o form guarda centavos crus; a máscara exibe `R$ 0,00`. */
function MoneyField({
  control,
  name,
  label,
  error,
  disabled,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control']
  name: 'amount' | 'discount' | 'fine' | 'interest'
  label: string
  error?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} htmlFor={name} error={error} className="md:col-span-3 lg:col-span-3">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <MaskedInput
            id={name}
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={field.value}
            onChange={field.onChange}
            mask={maskMoney}
            maxDigits={12}
            disabled={disabled}
          />
        )}
      />
    </Field>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-sm">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

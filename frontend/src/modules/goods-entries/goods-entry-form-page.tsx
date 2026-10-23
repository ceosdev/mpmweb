import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { goodsEntriesApi } from '@/services/goods-entries-api'
import { documentTypesApi } from '@/services/document-types-api'
import { paymentTypesApi } from '@/services/payment-types-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { maskMoney } from '@/lib/masks'
import { PageHeader } from '@/components/page-header'
import { FullPageLoader } from '@/components/full-page-loader'
import { MaskedInput } from '@/components/form/masked-input'
import { EntityPicker } from '@/components/common/entity-picker'
import { GoodsEntryItemsSection } from '@/modules/goods-entries/goods-entry-items-section'
import {
  emptyValues,
  schema,
  toFormValues,
  toGoodsEntryPayload,
  type FormValues,
} from '@/modules/goods-entries/goods-entry-form-values'
import { GoodsEntryStatusBadge } from '@/modules/goods-entries/goods-entry-status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Campos de "Totais da nota": valores em reais destacados na NF-e. */
const TOTAL_FIELDS = [
  { name: 'icmsSt', label: 'ICMS ST' },
  { name: 'ipi', label: 'IPI' },
  { name: 'freight', label: 'Frete' },
  { name: 'insurance', label: 'Seguro' },
  { name: 'otherExpenses', label: 'Outras despesas' },
] as const

interface GoodsEntryFormPageProps {
  mode: 'create' | 'edit' | 'view'
}

/**
 * Formulário da entrada de mercadoria, em rota dedicada (~16 campos em 4 seções
 * mais a grade de itens — o mesmo motivo pelo qual Empresas e Perfis usam rota
 * própria em vez de modal). Espelha `modules/companies/company-form-page.tsx`
 * na estrutura e `modules/payables/payable-form-dialog.tsx` no tratamento de
 * moeda/data.
 */
export function GoodsEntryFormPage({ mode }: GoodsEntryFormPageProps) {
  const { id } = useParams<{ id: string }>()
  const isCreate = mode === 'create'
  const isEdit = mode === 'edit'
  const readOnly = mode === 'view'
  const entryId = id ? Number(id) : null

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const detailQuery = useQuery({
    queryKey: ['goods-entry', companyId, entryId],
    queryFn: () => goodsEntriesApi.get(entryId!),
    enabled: !isCreate && entryId !== null,
  })
  const entry = detailQuery.data

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (isCreate || !entry) return
    form.reset(toFormValues(entry))
  }, [isCreate, entry, form])

  const documentTypesQuery = useQuery({
    queryKey: ['document-types', companyId, 'options'],
    queryFn: () =>
      documentTypesApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  })
  const documentTypeOptions = useMemo(() => {
    const all = documentTypesQuery.data?.data ?? []
    const active = all.filter((type) => type.isActive)
    if (entry?.documentTypeId && !active.some((type) => type.id === entry.documentTypeId)) {
      const current = all.find((type) => type.id === entry.documentTypeId)
      if (current) return [current, ...active]
    }
    return active
  }, [documentTypesQuery.data, entry])

  const paymentTypesQuery = useQuery({
    queryKey: ['payment-types', companyId, 'options'],
    queryFn: () =>
      paymentTypesApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  })
  const paymentTypeOptions = useMemo(() => {
    const all = paymentTypesQuery.data?.data ?? []
    const active = all.filter((type) => type.isActive)
    if (entry?.paymentTypeId && !active.some((type) => type.id === entry.paymentTypeId)) {
      const current = all.find((type) => type.id === entry.paymentTypeId)
      if (current) return [current, ...active]
    }
    return active
  }, [paymentTypesQuery.data, entry])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toGoodsEntryPayload(values)
      if (isEdit && entryId) return goodsEntriesApi.update(entryId, payload)
      return goodsEntriesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Entrada atualizada.' : 'Entrada lançada.')
      queryClient.invalidateQueries({ queryKey: ['goods-entries', companyId] })
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: ['goods-entry', companyId, entryId] })
      }
      navigate('/goods-entries')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function onSubmit(values: FormValues) {
    // Bloqueio local: a finalização não faz sentido sobre uma nota sem produtos,
    // e o backend rejeitaria de qualquer forma — aqui é só feedback mais cedo.
    if (values.items.length === 0) {
      toast.error('Adicione ao menos um produto.')
      return
    }
    mutation.mutate(values)
  }

  if (!isCreate && detailQuery.isLoading) {
    return <FullPageLoader />
  }

  const title = isCreate
    ? 'Nova entrada de mercadoria'
    : readOnly
      ? 'Visualizar entrada de mercadoria'
      : 'Editar entrada de mercadoria'

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <PageHeader
          icon={PackagePlus}
          title={title}
          description="Nota fiscal de mercadoria recebida de um fornecedor, com seus produtos, totais e condição de pagamento."
        >
          {/* Só existe status para uma entrada já salva — quem abre em modo
              visualização/edição precisa ver se está Aberta, Finalizada ou
              Cancelada sem adivinhar pelos campos desabilitados. */}
          {!isCreate && entry && <GoodsEntryStatusBadge status={entry.status} />}
          <Button variant="outline" asChild>
            <Link to="/goods-entries">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
        </PageHeader>

        <form
          id="goods-entry-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Informações do documento
            </h2>
            <div className="grid gap-4 md:grid-cols-6">
              <Field
                label="Tipo de documento"
                htmlFor="documentTypeId"
                error={form.formState.errors.documentTypeId?.message}
                className="md:col-span-3"
              >
                <Controller
                  control={form.control}
                  name="documentTypeId"
                  render={({ field }) => (
                    // `value && ...`: o Radix Select tem um <select> nativo oculto
                    // (acessibilidade/autofill) cujas <option> só existem enquanto o
                    // dropdown já foi aberto ao menos uma vez. Ao popular o valor via
                    // `form.reset` no load do edit (dropdown ainda fechado), esse
                    // <select> nativo ecoa um onValueChange('') espúrio que zeraria o
                    // campo — a guarda ignora esse eco.
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => value && field.onChange(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger id="documentTypeId" className="w-full">
                        <SelectValue
                          placeholder={documentTypesQuery.isLoading ? 'Carregando…' : 'Selecione'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypeOptions.map((type) => (
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
                label="Número do documento"
                htmlFor="documentNumber"
                error={form.formState.errors.documentNumber?.message}
                className="md:col-span-3"
              >
                <Input
                  id="documentNumber"
                  maxLength={20}
                  disabled={readOnly}
                  {...form.register('documentNumber')}
                />
              </Field>

              <Field
                label="Série"
                htmlFor="series"
                error={form.formState.errors.series?.message}
                className="md:col-span-2"
              >
                <Input
                  id="series"
                  maxLength={10}
                  disabled={readOnly}
                  {...form.register('series')}
                />
              </Field>

              <Field
                label="Sub-série"
                htmlFor="subSeries"
                error={form.formState.errors.subSeries?.message}
                className="md:col-span-2"
              >
                <Input
                  id="subSeries"
                  maxLength={10}
                  disabled={readOnly}
                  {...form.register('subSeries')}
                />
              </Field>

              <Field
                label="Data de emissão"
                htmlFor="issueDate"
                error={form.formState.errors.issueDate?.message}
                className="md:col-span-2"
              >
                <Input
                  id="issueDate"
                  type="date"
                  disabled={readOnly}
                  {...form.register('issueDate')}
                />
              </Field>

              <Field
                label="Fornecedor"
                htmlFor="supplierId"
                error={form.formState.errors.supplierId?.message}
                className="md:col-span-4"
              >
                <Controller
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <EntityPicker
                      id="supplierId"
                      source="supplier"
                      value={field.value ? field.value : null}
                      onChange={(value) => field.onChange(value ?? 0)}
                      invalid={Boolean(form.formState.errors.supplierId)}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>

              <Field
                label="Valor de desconto da NFe"
                htmlFor="discount"
                error={form.formState.errors.discount?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <MaskedInput
                      id="discount"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskMoney}
                      maxDigits={12}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Totais da nota
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {TOTAL_FIELDS.map(({ name, label }) => (
                <TotalField
                  key={name}
                  control={form.control}
                  name={name}
                  label={label}
                  error={form.formState.errors[name]?.message}
                  disabled={readOnly}
                />
              ))}
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Informações de pagamento
            </h2>
            <div className="grid gap-4 md:grid-cols-6">
              <Field
                label="Tipo de pagamento"
                htmlFor="paymentTypeId"
                error={form.formState.errors.paymentTypeId?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="paymentTypeId"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => value && field.onChange(Number(value))}
                      disabled={readOnly}
                    >
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
                label="Qtd. parcelas"
                htmlFor="installmentCount"
                error={form.formState.errors.installmentCount?.message}
                className="md:col-span-2"
              >
                <Input
                  id="installmentCount"
                  type="number"
                  min={1}
                  disabled={readOnly}
                  {...form.register('installmentCount', { valueAsNumber: true })}
                />
              </Field>

              <Field
                label="1º vencimento"
                htmlFor="firstDueDate"
                error={form.formState.errors.firstDueDate?.message}
                className="md:col-span-2"
              >
                <Input
                  id="firstDueDate"
                  type="date"
                  disabled={readOnly}
                  {...form.register('firstDueDate')}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Produtos</h2>
            <GoodsEntryItemsSection name="items" readOnly={readOnly} />
          </Card>

          <div className="flex justify-end gap-2">
            {readOnly ? (
              <Button type="button" variant="outline" asChild>
                <Link to="/goods-entries">Fechar</Link>
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link to="/goods-entries">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Salvar
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  )
}

/** Um dos campos de totais da nota — todos `MaskedInput` com `maskMoney`. */
function TotalField({
  control,
  name,
  label,
  error,
  disabled,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control']
  name: (typeof TOTAL_FIELDS)[number]['name']
  label: string
  error?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} htmlFor={name} error={error}>
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
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

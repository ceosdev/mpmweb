import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileInput as FileInputIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { serviceEntriesApi } from '@/services/service-entries-api'
import { documentTypesApi } from '@/services/document-types-api'
import { paymentTypesApi } from '@/services/payment-types-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { centsToReais, maskMoney, reaisToCents } from '@/lib/masks'
import { todayIso } from '@/lib/format'
import type { ServiceEntry, ServiceEntryPayload, TaxWithholding } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { FullPageLoader } from '@/components/full-page-loader'
import { MaskedInput } from '@/components/form/masked-input'
import { EntityPicker } from '@/components/common/entity-picker'
import {
  ServiceEntryItemsSection,
  type ServiceEntryItemFormValue,
} from '@/modules/service-entries/service-entry-items-section'
import { ServiceEntryStatusBadge } from '@/modules/service-entries/service-entry-status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Os 6 campos são valores em reais destacados na nota — nunca alíquotas. */
const TAX_FIELDS = ['iss', 'pis', 'cofins', 'inss', 'irrf', 'csll'] as const

// `satisfies`, não uma anotação `z.ZodType<T>`: preserva a forma inferida pelo
// zod (necessária para o `zodResolver` tipar o array corretamente) e ainda
// verifica que ela bate com `ServiceEntryItemFormValue`.
const itemSchema = z.object({
  serviceId: z.number().int().positive(),
  serviceDescription: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.string(),
  discount: z.string(),
}) satisfies z.ZodType<ServiceEntryItemFormValue>

/**
 * Campos monetários guardados como **string de centavos**; convertidos com
 * `centsToReais`/`reaisToCents` (`lib/masks.ts`) no submit e ao popular.
 */
const schema = z.object({
  documentTypeId: z
    .number({ error: 'Selecione o tipo de documento.' })
    .int()
    .positive('Selecione o tipo de documento.'),
  documentNumber: z
    .string()
    .trim()
    .min(1, 'Número do documento é obrigatório.')
    .max(20, 'Deve ter no máximo 20 caracteres.'),
  series: z.string().trim().max(10, 'Deve ter no máximo 10 caracteres.'),
  subSeries: z.string().trim().max(10, 'Deve ter no máximo 10 caracteres.'),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória.'),
  supplierId: z
    .number({ error: 'Selecione um fornecedor.' })
    .int()
    .positive('Selecione um fornecedor.'),
  discount: z.string(),
  taxWithholding: z.enum(['issuer', 'recipient']),
  iss: z.string(),
  pis: z.string(),
  cofins: z.string(),
  inss: z.string(),
  irrf: z.string(),
  csll: z.string(),
  paymentTypeId: z
    .number({ error: 'Selecione o tipo de pagamento.' })
    .int()
    .positive('Selecione o tipo de pagamento.'),
  installmentCount: z
    .number({ error: 'Informe a quantidade de parcelas.' })
    .int('Deve ser um número inteiro.')
    .min(1, 'Deve ser no mínimo 1.')
    .max(999, 'Deve ser no máximo 999.'),
  firstDueDate: z.string().min(1, '1º vencimento é obrigatório.'),
  items: z.array(itemSchema),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  const today = todayIso()
  return {
    documentTypeId: 0,
    documentNumber: '',
    series: '',
    subSeries: '',
    issueDate: today,
    supplierId: 0,
    discount: '',
    taxWithholding: 'issuer',
    iss: '',
    pis: '',
    cofins: '',
    inss: '',
    irrf: '',
    csll: '',
    paymentTypeId: 0,
    installmentCount: 1,
    firstDueDate: today,
    items: [],
  }
}

function toFormValues(entry: ServiceEntry): FormValues {
  return {
    documentTypeId: entry.documentTypeId,
    documentNumber: entry.documentNumber,
    series: entry.series ?? '',
    subSeries: entry.subSeries ?? '',
    issueDate: entry.issueDate,
    supplierId: entry.supplierId,
    discount: reaisToCents(entry.discount),
    taxWithholding: entry.taxWithholding,
    iss: reaisToCents(entry.iss),
    pis: reaisToCents(entry.pis),
    cofins: reaisToCents(entry.cofins),
    inss: reaisToCents(entry.inss),
    irrf: reaisToCents(entry.irrf),
    csll: reaisToCents(entry.csll),
    paymentTypeId: entry.paymentTypeId,
    installmentCount: entry.installmentCount,
    firstDueDate: entry.firstDueDate,
    items: (entry.items ?? []).map((item) => ({
      serviceId: item.serviceId,
      serviceDescription: item.serviceDescription ?? '',
      quantity: item.quantity,
      unitPrice: reaisToCents(item.unitPrice),
      discount: reaisToCents(item.discount),
    })),
  }
}

function toPayload(values: FormValues): ServiceEntryPayload {
  return {
    documentTypeId: values.documentTypeId,
    documentNumber: values.documentNumber.trim(),
    series: values.series.trim() || undefined,
    subSeries: values.subSeries.trim() || undefined,
    issueDate: values.issueDate,
    supplierId: values.supplierId,
    discount: centsToReais(values.discount),
    taxWithholding: values.taxWithholding,
    iss: centsToReais(values.iss),
    pis: centsToReais(values.pis),
    cofins: centsToReais(values.cofins),
    inss: centsToReais(values.inss),
    irrf: centsToReais(values.irrf),
    csll: centsToReais(values.csll),
    paymentTypeId: values.paymentTypeId,
    installmentCount: values.installmentCount,
    firstDueDate: values.firstDueDate,
    items: values.items.map((item) => ({
      serviceId: item.serviceId,
      quantity: item.quantity,
      unitPrice: centsToReais(item.unitPrice),
      discount: centsToReais(item.discount),
    })),
  }
}

interface ServiceEntryFormPageProps {
  mode: 'create' | 'edit' | 'view'
}

/**
 * Formulário da entrada de serviço, em rota dedicada (~16 campos em 4 seções
 * mais a grade de itens — o mesmo motivo pelo qual Empresas e Perfis usam rota
 * própria em vez de modal). Espelha `modules/companies/company-form-page.tsx`
 * na estrutura e `modules/payables/payable-form-dialog.tsx` no tratamento de
 * moeda/data.
 */
export function ServiceEntryFormPage({ mode }: ServiceEntryFormPageProps) {
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
    queryKey: ['service-entry', companyId, entryId],
    queryFn: () => serviceEntriesApi.get(entryId!),
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

  const taxWithholding = form.watch('taxWithholding')
  const taxFieldsDisabled = readOnly || taxWithholding === 'issuer'

  function handleTaxWithholdingChange(value: string) {
    form.setValue('taxWithholding', value as TaxWithholding)
    // Emissor não abate nada: os 6 campos ficam desabilitados e são zerados.
    if (value === 'issuer') {
      for (const field of TAX_FIELDS) form.setValue(field, '')
    }
  }

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
      const payload = toPayload(values)
      if (isEdit && entryId) return serviceEntriesApi.update(entryId, payload)
      return serviceEntriesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Entrada atualizada.' : 'Entrada lançada.')
      queryClient.invalidateQueries({ queryKey: ['service-entries', companyId] })
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: ['service-entry', companyId, entryId] })
      }
      navigate('/service-entries')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function onSubmit(values: FormValues) {
    // Bloqueio local: a finalização não faz sentido sobre uma nota sem serviços,
    // e o backend rejeitaria de qualquer forma — aqui é só feedback mais cedo.
    if (values.items.length === 0) {
      toast.error('Adicione ao menos um serviço.')
      return
    }
    mutation.mutate(values)
  }

  if (!isCreate && detailQuery.isLoading) {
    return <FullPageLoader />
  }

  const title = isCreate
    ? 'Nova entrada de serviço'
    : readOnly
      ? 'Visualizar entrada de serviço'
      : 'Editar entrada de serviço'

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <PageHeader
          icon={FileInputIcon}
          title={title}
          description="Nota fiscal de serviço recebida de um fornecedor, com seus serviços, impostos e condição de pagamento."
        >
          {/* Só existe status para uma entrada já salva — quem abre em modo
              visualização/edição precisa ver se está Aberta, Finalizada ou
              Cancelada sem adivinhar pelos campos desabilitados. */}
          {!isCreate && entry && <ServiceEntryStatusBadge status={entry.status} />}
          <Button variant="outline" asChild>
            <Link to="/service-entries">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
        </PageHeader>

        <form
          id="service-entry-form"
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
              Impostos da nota
            </h2>

            <Controller
              control={form.control}
              name="taxWithholding"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={handleTaxWithholdingChange}
                  disabled={readOnly}
                  className="gap-3"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="issuer" id="taxWithholdingIssuer" />
                    <Label htmlFor="taxWithholdingIssuer" className="font-normal">
                      Retenção de imposto por parte do emissor
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="recipient" id="taxWithholdingRecipient" />
                    <Label htmlFor="taxWithholdingRecipient" className="font-normal">
                      Retenção de imposto por parte do destinatário
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Valores em reais destacados na nota, não alíquotas.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <TaxField
                control={form.control}
                name="iss"
                label="ISS"
                error={form.formState.errors.iss?.message}
                disabled={taxFieldsDisabled}
              />
              <TaxField
                control={form.control}
                name="pis"
                label="PIS"
                error={form.formState.errors.pis?.message}
                disabled={taxFieldsDisabled}
              />
              <TaxField
                control={form.control}
                name="cofins"
                label="COFINS"
                error={form.formState.errors.cofins?.message}
                disabled={taxFieldsDisabled}
              />
              <TaxField
                control={form.control}
                name="inss"
                label="INSS"
                error={form.formState.errors.inss?.message}
                disabled={taxFieldsDisabled}
              />
              <TaxField
                control={form.control}
                name="irrf"
                label="IRRF"
                error={form.formState.errors.irrf?.message}
                disabled={taxFieldsDisabled}
              />
              <TaxField
                control={form.control}
                name="csll"
                label="CSLL"
                error={form.formState.errors.csll?.message}
                disabled={taxFieldsDisabled}
              />
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
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Serviços</h2>
            <ServiceEntryItemsSection name="items" readOnly={readOnly} />
          </Card>

          <div className="flex justify-end gap-2">
            {readOnly ? (
              <Button type="button" variant="outline" asChild>
                <Link to="/service-entries">Fechar</Link>
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link to="/service-entries">Cancelar</Link>
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

/** Um dos 6 campos de imposto — todos `MaskedInput` com `maskMoney`. */
function TaxField({
  control,
  name,
  label,
  error,
  disabled,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control']
  name: (typeof TAX_FIELDS)[number]
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

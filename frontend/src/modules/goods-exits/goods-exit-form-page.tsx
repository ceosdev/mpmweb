import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, PackageMinus } from 'lucide-react'
import { toast } from 'sonner'
import { goodsExitsApi } from '@/services/goods-exits-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { formatIsoDate, todayIso } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { FullPageLoader } from '@/components/full-page-loader'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EntityPicker } from '@/components/common/entity-picker'
import { GoodsExitItemsSection } from '@/modules/goods-exits/goods-exit-items-section'
import { GoodsExitStatusBadge } from '@/modules/goods-exits/goods-exit-status-badge'
import {
  emptyValues,
  schema,
  toFormValues,
  toGoodsExitPayload,
  type FormValues,
} from '@/modules/goods-exits/goods-exit-form-values'
import type { GoodsExitType } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface GoodsExitFormPageProps {
  mode: 'create' | 'edit' | 'view'
}

/**
 * Formulário da saída de mercadoria, em rota dedicada. Espelha
 * `modules/goods-entries/goods-entry-form-page.tsx`. `/goods-exits/:id` é o
 * mesmo formulário em `readOnly`.
 */
export function GoodsExitFormPage({ mode }: GoodsExitFormPageProps) {
  const { id } = useParams<{ id: string }>()
  const isCreate = mode === 'create'
  const isEdit = mode === 'edit'
  const readOnly = mode === 'view'
  const exitId = id ? Number(id) : null

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tenant, user } = useAuth()
  const companyId = tenant?.companyId

  // Troca de tipo de saída aguardando confirmação (há produtos na lista).
  const [pendingType, setPendingType] = useState<GoodsExitType | null>(null)

  const detailQuery = useQuery({
    queryKey: ['goods-exit', companyId, exitId],
    queryFn: () => goodsExitsApi.get(exitId!),
    enabled: !isCreate && exitId !== null,
  })
  const exit = detailQuery.data

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (isCreate || !exit) return
    form.reset(toFormValues(exit))
  }, [isCreate, exit, form])

  const exitType = useWatch({ control: form.control, name: 'exitType' })
  const consumerType = useWatch({ control: form.control, name: 'consumerType' })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toGoodsExitPayload(values)
      if (isEdit && exitId) return goodsExitsApi.update(exitId, payload)
      return goodsExitsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Saída de mercadoria atualizada.' : 'Saída de mercadoria criada.')
      queryClient.invalidateQueries({ queryKey: ['goods-exits', companyId] })
      if (exitId) {
        queryClient.invalidateQueries({ queryKey: ['goods-exit', companyId, exitId] })
      }
      navigate('/goods-exits')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function onSubmit(values: FormValues) {
    if (values.items.length === 0) {
      toast.error('Adicione ao menos um produto.')
      return
    }
    mutation.mutate(values)
  }

  /** Aplica o tipo de saída: ferramenta trava o consumidor em Funcionário. */
  function applyExitType(next: GoodsExitType) {
    form.setValue('exitType', next)
    form.setValue('items', [])
    if (next === 'tool' && form.getValues('consumerType') !== 'employee') {
      form.setValue('consumerType', 'employee')
      form.setValue('consumerId', 0)
    }
  }

  function handleExitTypeChange(next: GoodsExitType) {
    if (next === form.getValues('exitType')) return
    if (form.getValues('items').length > 0) {
      setPendingType(next)
      return
    }
    applyExitType(next)
  }

  function handleConsumerTypeChange(next: 'asset' | 'employee') {
    if (next === form.getValues('consumerType')) return
    form.setValue('consumerType', next)
    form.setValue('consumerId', 0)
    form.clearErrors('consumerId')
  }

  if (!isCreate && detailQuery.isLoading) {
    return <FullPageLoader />
  }

  const title = isCreate
    ? 'Nova saída de mercadoria'
    : readOnly
      ? 'Visualizar saída de mercadoria'
      : 'Editar saída de mercadoria'

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <PageHeader
          icon={PackageMinus}
          title={title}
          description="Requisição de produtos do almoxarifado para um ativo ou funcionário."
        >
          {!isCreate && exit && <GoodsExitStatusBadge status={exit.status} />}
          <Button variant="outline" asChild>
            <Link to="/goods-exits">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
        </PageHeader>

        <form id="goods-exit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Dados da requisição
            </h2>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Código" htmlFor="exitCode" className="md:col-span-2">
                <Input id="exitCode" value={exit ? String(exit.id) : ''} disabled readOnly />
              </Field>

              <Field label="Data da operação" htmlFor="operationDate" className="md:col-span-2">
                <Input
                  id="operationDate"
                  value={exit ? formatIsoDate(exit.operationDate) : formatIsoDate(todayIso())}
                  disabled
                  readOnly
                />
              </Field>

              <Field label="Usuário solicitante" htmlFor="requestedBy" className="md:col-span-2">
                <Input
                  id="requestedBy"
                  value={exit ? (exit.requestedByName ?? '') : (user?.name ?? '')}
                  disabled
                  readOnly
                />
              </Field>

              <Field label="Tipo de saída" htmlFor="exitTypeNormal" className="md:col-span-6">
                <RadioGroup
                  value={exitType}
                  onValueChange={(value) => handleExitTypeChange(value as GoodsExitType)}
                  disabled={readOnly || isEdit}
                  className="flex flex-wrap gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="normal" id="exitTypeNormal" />
                    <Label htmlFor="exitTypeNormal" className="font-normal">
                      Saída normal
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="tool" id="exitTypeTool" />
                    <Label htmlFor="exitTypeTool" className="font-normal">
                      Saída de ferramentas
                    </Label>
                  </div>
                </RadioGroup>
              </Field>

              <Field label="Tipo de consumidor" htmlFor="consumerType" className="md:col-span-2">
                <Select
                  value={consumerType}
                  onValueChange={(value) =>
                    value && handleConsumerTypeChange(value as 'asset' | 'employee')
                  }
                  disabled={readOnly || exitType === 'tool'}
                >
                  <SelectTrigger id="consumerType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Ativo</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Consumidor"
                htmlFor="consumerId"
                error={form.formState.errors.consumerId?.message}
                className="md:col-span-4"
              >
                <Controller
                  control={form.control}
                  name="consumerId"
                  render={({ field }) => (
                    <EntityPicker
                      // Remonta ao trocar o tipo: outra fonte, outro cache.
                      key={consumerType}
                      id="consumerId"
                      source={consumerType === 'asset' ? 'productAsset' : 'employee'}
                      value={field.value ? field.value : null}
                      onChange={(value) => field.onChange(value ?? 0)}
                      invalid={Boolean(form.formState.errors.consumerId)}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>

              <Field
                label="Observação"
                htmlFor="notes"
                error={form.formState.errors.notes?.message}
                className="md:col-span-6"
              >
                <Textarea id="notes" rows={3} disabled={readOnly} {...form.register('notes')} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Produtos</h2>
            <GoodsExitItemsSection name="items" readOnly={readOnly} />
          </Card>

          <div className="flex justify-end gap-2">
            {readOnly ? (
              <Button type="button" variant="outline" asChild>
                <Link to="/goods-exits">Fechar</Link>
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link to="/goods-exits">Cancelar</Link>
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

      <ConfirmDialog
        open={pendingType !== null}
        onOpenChange={(open) => !open && setPendingType(null)}
        title="Trocar o tipo de saída"
        description="Os produtos de um tipo de saída não servem no outro. Trocar o tipo remove os produtos já adicionados. Deseja continuar?"
        confirmLabel="Trocar tipo"
        onConfirm={() => {
          if (pendingType) applyExitType(pendingType)
          setPendingType(null)
        }}
      />
    </FormProvider>
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

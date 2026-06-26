import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  productsApi,
  type CreateProductPayload,
  type UpdateProductPayload,
} from '@/services/products-api'
import { productGroupsApi } from '@/services/product-groups-api'
import { productSubgroupsApi } from '@/services/product-subgroups-api'
import { unitsOfMeasureApi } from '@/services/units-of-measure-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { maskMoney, maskQuantity, parseDecimal } from '@/lib/masks'
import type { Product } from '@/types/api'
import { MaskedInput } from '@/components/form/masked-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PRODUCT_TYPES = ['consumable', 'fixed_asset'] as const
const NONE = 'none'

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.').max(120),
  /** Required: 'consumable' | 'fixed_asset'. */
  type: z
    .string()
    .refine((v): boolean => v === 'consumable' || v === 'fixed_asset', 'Selecione o tipo.'),
  /** 'none' | id */
  productGroupId: z.string(),
  productSubgroupId: z.string(),
  unitOfMeasureId: z.string(),
  controlsStock: z.boolean(),
  /** Masked pt-BR decimals. */
  minimumStock: z.string(),
  quantityInStock: z.string(),
  /** Raw, digits-only cents (e.g. "12345" = R$ 123,45). */
  costPrice: z.string(),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

/** Cents string ("12345") → reais number (123.45), or null when empty. */
function centsToReais(cents: string): number | null {
  if (!cents) return null
  return Number(cents) / 100
}

/** Reais number (123.45) → cents string ("12345"), or '' when null. */
function reaisToCents(value: number | null): string {
  if (value === null) return ''
  return String(Math.round(value * 100))
}

/** number | null → masked pt-BR string ('' when null). */
function numberToMask(value: number | null): string {
  if (value === null) return ''
  return maskQuantity(value.toString().replace('.', ','))
}

function emptyValues(): FormValues {
  return {
    description: '',
    type: NONE,
    productGroupId: NONE,
    productSubgroupId: NONE,
    unitOfMeasureId: NONE,
    controlsStock: false,
    minimumStock: '',
    quantityInStock: '',
    costPrice: '',
    isActive: true,
  }
}

function toFormValues(product: Product): FormValues {
  return {
    description: product.description,
    type: product.type,
    productGroupId: product.productGroupId ? String(product.productGroupId) : NONE,
    productSubgroupId: product.productSubgroupId ? String(product.productSubgroupId) : NONE,
    unitOfMeasureId: product.unitOfMeasureId ? String(product.unitOfMeasureId) : NONE,
    controlsStock: product.controlsStock,
    minimumStock: numberToMask(product.minimumStock),
    quantityInStock: numberToMask(product.quantityInStock),
    costPrice: reaisToCents(product.costPrice),
    isActive: product.isActive,
  }
}

function toPayload(values: FormValues, isEdit: boolean): CreateProductPayload {
  const controlsStock = values.controlsStock
  const base: CreateProductPayload = {
    description: values.description.trim(),
    type: values.type as (typeof PRODUCT_TYPES)[number],
    productGroupId: values.productGroupId === NONE ? null : Number(values.productGroupId),
    productSubgroupId:
      values.productSubgroupId === NONE ? null : Number(values.productSubgroupId),
    unitOfMeasureId: values.unitOfMeasureId === NONE ? null : Number(values.unitOfMeasureId),
    controlsStock,
    minimumStock: controlsStock ? parseDecimal(values.minimumStock) : null,
    costPrice: centsToReais(values.costPrice),
    isActive: values.isActive,
  }
  // quantityInStock is only sent on create (immutable afterwards).
  if (!isEdit) {
    base.quantityInStock = controlsStock ? parseDecimal(values.quantityInStock) : null
  }
  return base
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

/**
 * Create / edit a product of the active company. Modal layout.
 *
 * - Group / subgroup / unit are optional. Subgroup is a CASCADE of the chosen
 *   group; changing the group clears the subgroup. On edit, the currently-linked
 *   option is kept selectable even if it went inactive (link never lost).
 * - Stock fields are governed by "controla estoque": off → both disabled and
 *   cleared. Quantity is editable only on create (immutable afterwards — fed by
 *   the future stock-entry module).
 */
export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const isEdit = Boolean(product)
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(product ? toFormValues(product) : emptyValues())
  }, [open, product, form])

  const controlsStock = form.watch('controlsStock')
  const selectedGroupId = form.watch('productGroupId')
  const selectedType = form.watch('type')
  // Fixed assets never control stock — the stock fields are locked off.
  const isFixedAsset = selectedType === 'fixed_asset'

  const groupsQuery = useQuery({
    queryKey: ['product-groups', companyId, 'options'],
    queryFn: () =>
      productGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  const unitsQuery = useQuery({
    queryKey: ['units-of-measure', companyId, 'options'],
    queryFn: () =>
      unitsOfMeasureApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  const hasGroup = selectedGroupId !== NONE
  const subgroupsQuery = useQuery({
    queryKey: ['product-subgroups', companyId, selectedGroupId],
    queryFn: () =>
      productSubgroupsApi.list(Number(selectedGroupId), {
        page: 1,
        perPage: 200,
        sort: 'description',
        order: 'asc',
      }),
    enabled: open && hasGroup,
  })

  // Active options, plus the currently-linked one when editing (even if inactive).
  const groupOptions = useMemo(() => {
    const all = groupsQuery.data?.data ?? []
    const active = all.filter((g) => g.isActive)
    if (product?.productGroupId && !active.some((g) => g.id === product.productGroupId)) {
      const current = all.find((g) => g.id === product.productGroupId)
      if (current) return [current, ...active]
    }
    return active
  }, [groupsQuery.data, product])

  const unitOptions = useMemo(() => {
    const all = unitsQuery.data?.data ?? []
    const active = all.filter((u) => u.isActive)
    if (product?.unitOfMeasureId && !active.some((u) => u.id === product.unitOfMeasureId)) {
      const current = all.find((u) => u.id === product.unitOfMeasureId)
      if (current) return [current, ...active]
    }
    return active
  }, [unitsQuery.data, product])

  const subgroupOptions = useMemo(() => {
    const all = subgroupsQuery.data?.data ?? []
    const active = all.filter((s) => s.isActive)
    if (product?.productSubgroupId && !active.some((s) => s.id === product.productSubgroupId)) {
      const current = all.find((s) => s.id === product.productSubgroupId)
      if (current) return [current, ...active]
    }
    return active
  }, [subgroupsQuery.data, product])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEdit && product) {
        return productsApi.update(
          product.id,
          toPayload(values, true) satisfies UpdateProductPayload
        )
      }
      return productsApi.create(toPayload(values, false))
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Produto atualizado.' : 'Produto cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <form
          id="product-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-6">
            <Field
              label="Descrição do produto"
              htmlFor="description"
              error={form.formState.errors.description?.message}
              className="md:col-span-6"
            >
              <Input id="description" autoFocus {...form.register('description')} />
            </Field>

            <Field
              label="Tipo"
              htmlFor="type"
              error={form.formState.errors.type?.message}
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Fixed asset → force stock control off and clear stock.
                      if (value === 'fixed_asset') {
                        form.setValue('controlsStock', false)
                        form.setValue('minimumStock', '')
                        form.setValue('quantityInStock', '')
                      }
                    }}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumable">Uso e consumo</SelectItem>
                      <SelectItem value="fixed_asset">Ativo imobilizado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Unidade de medida" htmlFor="unitOfMeasureId" className="md:col-span-3">
              <Controller
                control={form.control}
                name="unitOfMeasureId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="unitOfMeasureId" className="w-full">
                      <SelectValue
                        placeholder={unitsQuery.isLoading ? 'Carregando…' : 'Selecione'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit.id} value={String(unit.id)}>
                          {unit.description}
                          {!unit.isActive ? ' (inativo)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Grupo de produto" htmlFor="productGroupId" className="md:col-span-3">
              <Controller
                control={form.control}
                name="productGroupId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Cascade: changing the group clears the subgroup.
                      form.setValue('productSubgroupId', NONE)
                    }}
                  >
                    <SelectTrigger id="productGroupId" className="w-full">
                      <SelectValue
                        placeholder={groupsQuery.isLoading ? 'Carregando…' : 'Selecione'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {groupOptions.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.description}
                          {!group.isActive ? ' (inativo)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Subgrupo de produto"
              htmlFor="productSubgroupId"
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="productSubgroupId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!hasGroup}>
                    <SelectTrigger id="productSubgroupId" className="w-full">
                      <SelectValue
                        placeholder={
                          !hasGroup
                            ? 'Selecione um grupo'
                            : subgroupsQuery.isLoading
                              ? 'Carregando…'
                              : 'Selecione'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {subgroupOptions.map((subgroup) => (
                        <SelectItem key={subgroup.id} value={String(subgroup.id)}>
                          {subgroup.description}
                          {!subgroup.isActive ? ' (inativo)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Preço de custo"
              htmlFor="costPrice"
              error={form.formState.errors.costPrice?.message}
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <MaskedInput
                    id="costPrice"
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

            <div className="md:col-span-3">
              <Controller
                control={form.control}
                name="controlsStock"
                render={({ field }) => (
                  <div className="flex h-full items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="controlsStock" className="text-sm">
                      Controla estoque
                    </Label>
                    <Switch
                      id="controlsStock"
                      checked={field.value}
                      disabled={isFixedAsset}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        if (!checked) {
                          // Stock governance: clear the stock fields when off.
                          form.setValue('minimumStock', '')
                          form.setValue('quantityInStock', '')
                        }
                      }}
                    />
                  </div>
                )}
              />
            </div>

            <Field label="Estoque mínimo" htmlFor="minimumStock" className="md:col-span-3">
              <Controller
                control={form.control}
                name="minimumStock"
                render={({ field }) => (
                  <Input
                    id="minimumStock"
                    inputMode="decimal"
                    placeholder="0"
                    disabled={!controlsStock || isFixedAsset}
                    value={field.value}
                    onChange={(event) => field.onChange(maskQuantity(event.target.value))}
                  />
                )}
              />
            </Field>

            <Field
              label="Quantidade em estoque"
              htmlFor="quantityInStock"
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="quantityInStock"
                render={({ field }) => (
                  <Input
                    id="quantityInStock"
                    inputMode="decimal"
                    placeholder="0"
                    disabled={!controlsStock || isEdit || isFixedAsset}
                    value={field.value}
                    onChange={(event) => field.onChange(maskQuantity(event.target.value))}
                  />
                )}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">Ajustado pela entrada de nota.</p>
              )}
            </Field>

            <div className="md:col-span-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex h-full items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="isActive" className="text-sm">
                      Ativo
                    </Label>
                    <Switch
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="product-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

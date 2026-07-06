import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  productAssetsApi,
  type CreateProductAssetPayload,
  type UpdateProductAssetPayload,
} from '@/services/product-assets-api'
import { brandsApi } from '@/services/brands-api'
import { brandModelsApi } from '@/services/brand-models-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { AssetSituation, ProductAsset } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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

const NONE = 'none'
const SITUATIONS = ['available', 'allocated', 'sold'] as const

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.').max(160),
  assetCode: z.string().trim().max(60),
  /** 'none' | brand id */
  brandId: z.string(),
  /** 'none' | model id */
  brandModelId: z.string(),
  manufactureYear: z.string().trim().max(4),
  btu: z.string().trim().max(20),
  situation: z.enum(SITUATIONS),
  equipmentExists: z.boolean(),
  notes: z.string().trim(),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    description: '',
    assetCode: '',
    brandId: NONE,
    brandModelId: NONE,
    manufactureYear: '',
    btu: '',
    situation: 'available',
    equipmentExists: true,
    notes: '',
  }
}

function toFormValues(asset: ProductAsset): FormValues {
  return {
    description: asset.description,
    assetCode: asset.assetCode ?? '',
    brandId: asset.brandId ? String(asset.brandId) : NONE,
    brandModelId: asset.brandModelId ? String(asset.brandModelId) : NONE,
    manufactureYear: asset.manufactureYear ?? '',
    btu: asset.btu ?? '',
    situation: asset.situation,
    equipmentExists: asset.equipmentExists,
    notes: asset.notes ?? '',
  }
}

function toPayload(values: FormValues): CreateProductAssetPayload {
  const brandId = values.brandId === NONE ? null : Number(values.brandId)
  return {
    description: values.description.trim(),
    assetCode: values.assetCode.trim() || null,
    brandId,
    // A model without a brand is meaningless — drop it when brand is cleared.
    brandModelId: brandId === null || values.brandModelId === NONE ? null : Number(values.brandModelId),
    manufactureYear: values.manufactureYear.trim() || null,
    btu: values.btu.trim() || null,
    situation: values.situation,
    equipmentExists: values.equipmentExists,
    notes: values.notes.trim() || null,
  }
}

interface ProductAssetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent product id — injected from the URL by the page. */
  productId: number
  asset: ProductAsset | null
}

/**
 * Create / edit an asset of a fixed-asset product. Modal layout.
 *
 * Brand / model are optional. Model is a CASCADE of the chosen brand; changing
 * the brand clears the model. On edit, the currently-linked option is kept
 * selectable even if it went inactive (link never lost).
 */
export function ProductAssetFormDialog({
  open,
  onOpenChange,
  productId,
  asset,
}: ProductAssetFormDialogProps) {
  const isEdit = Boolean(asset)
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(asset ? toFormValues(asset) : emptyValues())
  }, [open, asset, form])

  const selectedBrandId = form.watch('brandId')
  const hasBrand = selectedBrandId !== NONE

  const brandsQuery = useQuery({
    queryKey: ['brands', companyId, 'options'],
    queryFn: () => brandsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  const modelsQuery = useQuery({
    queryKey: ['brand-models', companyId, selectedBrandId],
    queryFn: () =>
      brandModelsApi.list(Number(selectedBrandId), {
        page: 1,
        perPage: 200,
        sort: 'description',
        order: 'asc',
      }),
    enabled: open && hasBrand,
  })

  // Active options, plus the currently-linked one when editing (even if inactive).
  const brandOptions = useMemo(() => {
    const all = brandsQuery.data?.data ?? []
    const active = all.filter((b) => b.isActive)
    if (asset?.brandId && !active.some((b) => b.id === asset.brandId)) {
      const current = all.find((b) => b.id === asset.brandId)
      if (current) return [current, ...active]
    }
    return active
  }, [brandsQuery.data, asset])

  const modelOptions = useMemo(() => {
    const all = modelsQuery.data?.data ?? []
    const active = all.filter((m) => m.isActive)
    if (asset?.brandModelId && !active.some((m) => m.id === asset.brandModelId)) {
      const current = all.find((m) => m.id === asset.brandModelId)
      if (current) return [current, ...active]
    }
    return active
  }, [modelsQuery.data, asset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && asset) {
        return productAssetsApi.update(
          productId,
          asset.id,
          payload satisfies UpdateProductAssetPayload
        )
      }
      return productAssetsApi.create(productId, payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Ativo atualizado.' : 'Ativo cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['product-assets', companyId, productId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar ativo' : 'Novo ativo'}</DialogTitle>
        </DialogHeader>

        <form
          id="product-asset-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-6">
            <Field
              label="Descrição do ativo"
              htmlFor="description"
              error={form.formState.errors.description?.message}
              className="md:col-span-4"
            >
              <Input id="description" autoFocus {...form.register('description')} />
            </Field>

            <Field
              label="Cód. patrimônio"
              htmlFor="assetCode"
              error={form.formState.errors.assetCode?.message}
              className="md:col-span-2"
            >
              <Input id="assetCode" {...form.register('assetCode')} />
            </Field>

            <Field label="Marca" htmlFor="brandId" className="md:col-span-3">
              <Controller
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Cascade: changing the brand clears the model.
                      form.setValue('brandModelId', NONE)
                    }}
                  >
                    <SelectTrigger id="brandId" className="w-full">
                      <SelectValue
                        placeholder={brandsQuery.isLoading ? 'Carregando…' : 'Selecione'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {brandOptions.map((brand) => (
                        <SelectItem key={brand.id} value={String(brand.id)}>
                          {brand.description}
                          {!brand.isActive ? ' (inativa)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Modelo" htmlFor="brandModelId" className="md:col-span-3">
              <Controller
                control={form.control}
                name="brandModelId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!hasBrand}>
                    <SelectTrigger id="brandModelId" className="w-full">
                      <SelectValue
                        placeholder={
                          !hasBrand
                            ? 'Selecione uma marca'
                            : modelsQuery.isLoading
                              ? 'Carregando…'
                              : 'Selecione'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {modelOptions.map((model) => (
                        <SelectItem key={model.id} value={String(model.id)}>
                          {model.description}
                          {!model.isActive ? ' (inativo)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Ano de fabricação" htmlFor="manufactureYear" className="md:col-span-2">
              <Input
                id="manufactureYear"
                inputMode="numeric"
                maxLength={4}
                placeholder="Ex.: 2022"
                {...form.register('manufactureYear')}
              />
            </Field>

            <Field label="BTU" htmlFor="btu" className="md:col-span-2">
              <Input id="btu" placeholder="Ex.: 12000" {...form.register('btu')} />
            </Field>

            <Field label="Situação" htmlFor="situation" className="md:col-span-2">
              <Controller
                control={form.control}
                name="situation"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as AssetSituation)}
                  >
                    <SelectTrigger id="situation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponível</SelectItem>
                      <SelectItem value="allocated">Alocado</SelectItem>
                      <SelectItem value="sold">Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="md:col-span-6">
              <Controller
                control={form.control}
                name="equipmentExists"
                render={({ field }) => (
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <Checkbox
                      id="equipmentExists"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="equipmentExists" className="text-sm font-normal">
                      Equipamento existe
                    </Label>
                  </div>
                )}
              />
            </div>

            <Field label="Observação" htmlFor="notes" className="md:col-span-6">
              <Textarea id="notes" rows={3} {...form.register('notes')} />
            </Field>
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
          <Button type="submit" form="product-asset-form" disabled={mutation.isPending}>
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

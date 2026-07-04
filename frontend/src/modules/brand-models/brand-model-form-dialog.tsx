import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  brandModelsApi,
  type CreateBrandModelPayload,
  type UpdateBrandModelPayload,
} from '@/services/brand-models-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { BrandModel } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface BrandModelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent brand id — injected from the URL by the page. */
  brandId: number
  brandModel: BrandModel | null
}

export function BrandModelFormDialog({
  open,
  onOpenChange,
  brandId,
  brandModel,
}: BrandModelFormDialogProps) {
  const isEdit = Boolean(brandModel)
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', isActive: true },
  })

  useEffect(() => {
    if (!open) return
    reset({
      description: brandModel?.description ?? '',
      isActive: brandModel?.isActive ?? true,
    })
  }, [open, brandModel, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && brandModel) {
        return brandModelsApi.update(
          brandId,
          brandModel.id,
          payload satisfies UpdateBrandModelPayload
        )
      }
      return brandModelsApi.create(brandId, payload satisfies CreateBrandModelPayload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Modelo atualizado.' : 'Modelo criado.')
      queryClient.invalidateQueries({ queryKey: ['brand-models', companyId, brandId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
        </DialogHeader>

        <form
          id="brand-models-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" autoFocus {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Ativo</Label>
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-models-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  unitsOfMeasureApi,
  type CreateUnitOfMeasurePayload,
  type UpdateUnitOfMeasurePayload,
} from '@/services/units-of-measure-api'
import { getErrorMessage } from '@/lib/errors'
import type { UnitOfMeasure } from '@/types/api'
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

interface UnitOfMeasureFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unitOfMeasure: UnitOfMeasure | null
}

export function UnitOfMeasureFormDialog({
  open,
  onOpenChange,
  unitOfMeasure,
}: UnitOfMeasureFormDialogProps) {
  const isEdit = Boolean(unitOfMeasure)
  const queryClient = useQueryClient()

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
      description: unitOfMeasure?.description ?? '',
      isActive: unitOfMeasure?.isActive ?? true,
    })
  }, [open, unitOfMeasure, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && unitOfMeasure) {
        return unitsOfMeasureApi.update(unitOfMeasure.id, payload satisfies UpdateUnitOfMeasurePayload)
      }
      return unitsOfMeasureApi.create(payload satisfies CreateUnitOfMeasurePayload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Unidade de medida atualizada.' : 'Unidade de medida criada.')
      queryClient.invalidateQueries({ queryKey: ['units-of-measure'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar unidade de medida' : 'Nova unidade de medida'}</DialogTitle>
        </DialogHeader>

        <form
          id="unit-of-measure-form"
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
                <Label htmlFor="isActive">Ativa</Label>
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="unit-of-measure-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

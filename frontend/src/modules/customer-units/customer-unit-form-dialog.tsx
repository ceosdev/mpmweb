import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  customerUnitsApi,
  type CreateCustomerUnitPayload,
  type UpdateCustomerUnitPayload,
} from '@/services/customer-units-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { CustomerUnit } from '@/types/api'
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
  description: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória.')
    .max(120, 'Deve ter no máximo 120 caracteres.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface CustomerUnitFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent ids — injected from the URL by the page. */
  customerId: number
  regionId: number
  unit: CustomerUnit | null
}

export function CustomerUnitFormDialog({
  open,
  onOpenChange,
  customerId,
  regionId,
  unit,
}: CustomerUnitFormDialogProps) {
  const isEdit = Boolean(unit)
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
      description: unit?.description ?? '',
      isActive: unit?.isActive ?? true,
    })
  }, [open, unit, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && unit) {
        return customerUnitsApi.update(
          customerId,
          regionId,
          unit.id,
          payload satisfies UpdateCustomerUnitPayload
        )
      }
      return customerUnitsApi.create(
        customerId,
        regionId,
        payload satisfies CreateCustomerUnitPayload
      )
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Unidade atualizada.' : 'Unidade criada.')
      queryClient.invalidateQueries({ queryKey: ['customer-units', companyId, regionId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
        </DialogHeader>

        <form
          id="customer-units-form"
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
          <Button type="submit" form="customer-units-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

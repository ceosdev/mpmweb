import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  paymentTypesApi,
  type CreatePaymentTypePayload,
  type UpdatePaymentTypePayload,
} from '@/services/payment-types-api'
import { getErrorMessage } from '@/lib/errors'
import type { PaymentType } from '@/types/api'
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

interface PaymentTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The record being edited, or `null` to create a new one. */
  paymentType: PaymentType | null
}

/**
 * Create / edit a payment type. Two fields fit comfortably in a modal
 * (regra `crud-form-presentation`).
 */
export function PaymentTypeFormDialog({
  open,
  onOpenChange,
  paymentType,
}: PaymentTypeFormDialogProps) {
  const isEdit = Boolean(paymentType)
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
      description: paymentType?.description ?? '',
      isActive: paymentType?.isActive ?? true,
    })
  }, [open, paymentType, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && paymentType) {
        return paymentTypesApi.update(paymentType.id, payload satisfies UpdatePaymentTypePayload)
      }
      return paymentTypesApi.create(payload satisfies CreatePaymentTypePayload)
    },
    onSuccess: () => {
      toast.success(
        isEdit ? 'Tipo de pagamento atualizado.' : 'Tipo de pagamento criado.'
      )
      queryClient.invalidateQueries({ queryKey: ['payment-types'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tipo de pagamento' : 'Novo tipo de pagamento'}</DialogTitle>
        </DialogHeader>

        <form
          id="payment-type-form"
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="payment-type-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

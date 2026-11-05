import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  customerRegionsApi,
  type CreateCustomerRegionPayload,
  type UpdateCustomerRegionPayload,
} from '@/services/customer-regions-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { CustomerRegion } from '@/types/api'
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

interface CustomerRegionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent customer id — injected from the URL by the page. */
  customerId: number
  region: CustomerRegion | null
}

export function CustomerRegionFormDialog({
  open,
  onOpenChange,
  customerId,
  region,
}: CustomerRegionFormDialogProps) {
  const isEdit = Boolean(region)
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
      description: region?.description ?? '',
      isActive: region?.isActive ?? true,
    })
  }, [open, region, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && region) {
        return customerRegionsApi.update(
          customerId,
          region.id,
          payload satisfies UpdateCustomerRegionPayload
        )
      }
      return customerRegionsApi.create(customerId, payload satisfies CreateCustomerRegionPayload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Regional atualizada.' : 'Regional criada.')
      queryClient.invalidateQueries({ queryKey: ['customer-regions', companyId, customerId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar regional' : 'Nova regional'}</DialogTitle>
        </DialogHeader>

        <form
          id="customer-regions-form"
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
          <Button type="submit" form="customer-regions-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

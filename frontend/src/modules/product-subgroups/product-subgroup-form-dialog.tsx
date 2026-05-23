import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  productSubgroupsApi,
  type CreateProductSubgroupPayload,
  type UpdateProductSubgroupPayload,
} from '@/services/product-subgroups-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { ProductSubgroup } from '@/types/api'
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

interface ProductSubgroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent product group id — injected from the URL by the page. */
  groupId: number
  productSubgroup: ProductSubgroup | null
}

export function ProductSubgroupFormDialog({
  open,
  onOpenChange,
  groupId,
  productSubgroup,
}: ProductSubgroupFormDialogProps) {
  const isEdit = Boolean(productSubgroup)
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
      description: productSubgroup?.description ?? '',
      isActive: productSubgroup?.isActive ?? true,
    })
  }, [open, productSubgroup, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && productSubgroup) {
        return productSubgroupsApi.update(
          groupId,
          productSubgroup.id,
          payload satisfies UpdateProductSubgroupPayload
        )
      }
      return productSubgroupsApi.create(
        groupId,
        payload satisfies CreateProductSubgroupPayload
      )
    },
    onSuccess: () => {
      toast.success(
        isEdit ? 'Subgrupo de produto atualizado.' : 'Subgrupo de produto criado.'
      )
      queryClient.invalidateQueries({
        queryKey: ['product-subgroups', companyId, groupId],
      })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar subgrupo de produto' : 'Novo subgrupo de produto'}
          </DialogTitle>
        </DialogHeader>

        <form
          id="product-subgroups-form"
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
          <Button type="submit" form="product-subgroups-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ldfParametersApi,
  type CreateLdfParameterPayload,
  type UpdateLdfParameterPayload,
} from '@/services/ldf-parameters-api'
import { expenseGroupsApi } from '@/services/expense-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import type { LdfParameter } from '@/types/api'
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

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.').max(120),
  expenseGroupId: z.string().min(1, 'Selecione o grupo de despesa.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return { description: '', expenseGroupId: '', isActive: true }
}

function toFormValues(ldfParameter: LdfParameter): FormValues {
  return {
    description: ldfParameter.description,
    expenseGroupId: String(ldfParameter.expenseGroupId),
    isActive: ldfParameter.isActive,
  }
}

interface LdfParameterFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The record being edited, or `null` to create a new one. */
  ldfParameter: LdfParameter | null
}

/**
 * Create / edit a parametrização de LDF. Three fields fit comfortably in a
 * modal (regra `crud-form-presentation`). The expense group is chosen from a
 * Select listing only the active groups — except, on edit, the currently-linked
 * group is kept selectable even if it went inactive, so the link is never
 * silently lost.
 */
export function LdfParameterFormDialog({
  open,
  onOpenChange,
  ldfParameter,
}: LdfParameterFormDialogProps) {
  const isEdit = Boolean(ldfParameter)
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
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    reset(ldfParameter ? toFormValues(ldfParameter) : emptyValues())
  }, [open, ldfParameter, reset])

  const groupsQuery = useQuery({
    queryKey: ['expense-groups', companyId, 'options'],
    queryFn: () =>
      expenseGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  // Active groups, plus the currently-linked group when editing (even if inactive).
  const groupOptions = useMemo(() => {
    const all = groupsQuery.data?.data ?? []
    const active = all.filter((group) => group.isActive)
    if (ldfParameter && !active.some((group) => group.id === ldfParameter.expenseGroupId)) {
      const current = all.find((group) => group.id === ldfParameter.expenseGroupId)
      if (current) return [current, ...active]
    }
    return active
  }, [groupsQuery.data, ldfParameter])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        expenseGroupId: Number(values.expenseGroupId),
        isActive: values.isActive,
      }
      if (isEdit && ldfParameter) {
        return ldfParametersApi.update(
          ldfParameter.id,
          payload satisfies UpdateLdfParameterPayload
        )
      }
      return ldfParametersApi.create(payload satisfies CreateLdfParameterPayload)
    },
    onSuccess: () => {
      toast.success(
        isEdit ? 'Parametrização de LDF atualizada.' : 'Parametrização de LDF criada.'
      )
      queryClient.invalidateQueries({ queryKey: ['ldf-parameters'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar parametrização de LDF' : 'Nova parametrização de LDF'}
          </DialogTitle>
        </DialogHeader>

        <form
          id="ldf-parameter-form"
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

          <div className="space-y-1.5">
            <Label htmlFor="expenseGroupId">Grupo de despesa</Label>
            <Controller
              control={control}
              name="expenseGroupId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expenseGroupId" className="w-full">
                    <SelectValue
                      placeholder={groupsQuery.isLoading ? 'Carregando…' : 'Selecione'}
                    />
                  </SelectTrigger>
                  <SelectContent>
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
            {errors.expenseGroupId && (
              <p className="text-xs text-destructive">{errors.expenseGroupId.message}</p>
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="ldf-parameter-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

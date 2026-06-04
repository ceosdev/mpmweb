import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  servicesApi,
  type CreateServicePayload,
  type UpdateServicePayload,
} from '@/services/services-api'
import { serviceGroupsApi } from '@/services/service-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { maskMoney } from '@/lib/masks'
import type { Service } from '@/types/api'
import { MaskedInput } from '@/components/form/masked-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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

const SERVICE_TYPES = ['internal', 'third_party'] as const

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.').max(120),
  serviceGroupId: z.string().min(1, 'Selecione o grupo do serviço.'),
  type: z.enum(SERVICE_TYPES, { message: 'Selecione o tipo.' }),
  /** Raw, digits-only cents (e.g. "12345" = R$ 123,45). Empty = sem valor. */
  suggestedValue: z.string(),
  notes: z.string().trim().max(1000, 'Deve ter no máximo 1000 caracteres.').optional().or(z.literal('')),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

/** Cents string ("12345") → reais number (123.45), or undefined when empty. */
function centsToReais(cents: string): number | undefined {
  if (!cents) return undefined
  return Number(cents) / 100
}

/** Reais number (123.45) → cents string ("12345"), or '' when null. */
function reaisToCents(value: number | null): string {
  if (value === null) return ''
  return String(Math.round(value * 100))
}

function emptyValues(): FormValues {
  return {
    description: '',
    serviceGroupId: '',
    type: 'internal',
    suggestedValue: '',
    notes: '',
    isActive: true,
  }
}

function toFormValues(service: Service): FormValues {
  return {
    description: service.description,
    serviceGroupId: String(service.serviceGroupId),
    type: service.type,
    suggestedValue: reaisToCents(service.suggestedValue),
    notes: service.notes ?? '',
    isActive: service.isActive,
  }
}

function toPayload(values: FormValues): CreateServicePayload {
  return {
    description: values.description.trim(),
    serviceGroupId: Number(values.serviceGroupId),
    type: values.type,
    suggestedValue: centsToReais(values.suggestedValue),
    notes: values.notes?.trim() || undefined,
    isActive: values.isActive,
  }
}

interface ServiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
}

/**
 * Create / edit a service of the active company. Modal layout. The group is
 * chosen from a Select listing only the active service groups — except, on
 * edit, the currently-linked group is kept selectable even if it went inactive,
 * so the link is never silently lost.
 */
export function ServiceFormDialog({ open, onOpenChange, service }: ServiceFormDialogProps) {
  const isEdit = Boolean(service)
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(service ? toFormValues(service) : emptyValues())
  }, [open, service, form])

  const groupsQuery = useQuery({
    queryKey: ['service-groups', companyId, 'options'],
    queryFn: () =>
      serviceGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  // Active groups, plus the currently-linked group when editing (even if inactive).
  const groupOptions = useMemo(() => {
    const all = groupsQuery.data?.data ?? []
    const active = all.filter((g) => g.isActive)
    if (service && !active.some((g) => g.id === service.serviceGroupId)) {
      const current = all.find((g) => g.id === service.serviceGroupId)
      if (current) return [current, ...active]
    }
    return active
  }, [groupsQuery.data, service])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && service) {
        return servicesApi.update(service.id, payload satisfies UpdateServicePayload)
      }
      return servicesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Serviço atualizado.' : 'Serviço cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>

        <form
          id="service-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-6">
            <Field
              label="Descrição do serviço"
              htmlFor="description"
              error={form.formState.errors.description?.message}
              className="md:col-span-6"
            >
              <Input id="description" autoFocus {...form.register('description')} />
            </Field>

            <Field
              label="Grupo do serviço"
              htmlFor="serviceGroupId"
              error={form.formState.errors.serviceGroupId?.message}
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="serviceGroupId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="serviceGroupId" className="w-full">
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Serviço interno</SelectItem>
                      <SelectItem value="third_party">Serviço de terceiro</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Valor sugerido"
              htmlFor="suggestedValue"
              error={form.formState.errors.suggestedValue?.message}
              className="md:col-span-3"
            >
              <Controller
                control={form.control}
                name="suggestedValue"
                render={({ field }) => (
                  <MaskedInput
                    id="suggestedValue"
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

            <Field
              label="Observações"
              htmlFor="notes"
              error={form.formState.errors.notes?.message}
              className="md:col-span-6"
            >
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
          <Button type="submit" form="service-form" disabled={mutation.isPending}>
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

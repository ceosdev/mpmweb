import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  suppliersApi,
  type CreateSupplierPayload,
  type UpdateSupplierPayload,
} from '@/services/suppliers-api'
import { getErrorMessage } from '@/lib/errors'
import { maskCep, maskPhone, maskTaxId, onlyDigits } from '@/lib/masks'
import { isValidTaxId } from '@/lib/tax-id'
import type { Supplier } from '@/types/api'
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

const schema = z.object({
  taxId: z
    .string()
    .refine((v) => v.length === 11 || v.length === 14, 'CPF/CNPJ deve ter 11 ou 14 dígitos.')
    .refine((v) => isValidTaxId(v), 'CPF/CNPJ inválido.'),
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  type: z.enum(['goods', 'service'], { message: 'Selecione o tipo.' }),
  address: z.string().trim().max(160).optional().or(z.literal('')),
  neighborhood: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  zipCode: z
    .string()
    .refine((v) => v === '' || v.length === 8, 'CEP deve ter 8 dígitos.'),
  phone: z
    .string()
    .refine(
      (v) => v === '' || v.length === 10 || v.length === 11,
      'Telefone deve ter 10 ou 11 dígitos.'
    ),
  mobile: z
    .string()
    .refine(
      (v) => v === '' || v.length === 10 || v.length === 11,
      'Celular deve ter 10 ou 11 dígitos.'
    ),
  contactName: z.string().trim().max(120).optional().or(z.literal('')),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    taxId: '',
    name: '',
    type: 'goods',
    address: '',
    neighborhood: '',
    city: '',
    zipCode: '',
    phone: '',
    mobile: '',
    contactName: '',
    isActive: true,
  }
}

function toFormValues(supplier: Supplier): FormValues {
  return {
    taxId: onlyDigits(supplier.taxId),
    name: supplier.name,
    type: supplier.type,
    address: supplier.address ?? '',
    neighborhood: supplier.neighborhood ?? '',
    city: supplier.city ?? '',
    zipCode: onlyDigits(supplier.zipCode),
    phone: onlyDigits(supplier.phone),
    mobile: onlyDigits(supplier.mobile),
    contactName: supplier.contactName ?? '',
    isActive: supplier.isActive,
  }
}

function toPayload(values: FormValues): CreateSupplierPayload {
  const trimmed = (v: string) => v.trim()
  return {
    taxId: values.taxId,
    name: trimmed(values.name),
    type: values.type,
    address: trimmed(values.address ?? '') || undefined,
    neighborhood: trimmed(values.neighborhood ?? '') || undefined,
    city: trimmed(values.city ?? '') || undefined,
    zipCode: values.zipCode || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    contactName: trimmed(values.contactName ?? '') || undefined,
    isActive: values.isActive,
  }
}

interface SupplierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
}

/**
 * Create / edit a supplier of the active company. Modal layout chosen by
 * product even though there are 11 fields — they are grouped in 4 sections to
 * keep the form digestible.
 */
export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const isEdit = Boolean(supplier)
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(supplier ? toFormValues(supplier) : emptyValues())
  }, [open, supplier, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && supplier) {
        return suppliersApi.update(supplier.id, payload satisfies UpdateSupplierPayload)
      }
      return suppliersApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
        </DialogHeader>

        <form
          id="supplier-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-6"
        >
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Identificação</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field
                label="CPF/CNPJ"
                htmlFor="taxId"
                error={form.formState.errors.taxId?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <MaskedInput
                      id="taxId"
                      autoFocus
                      placeholder="000.000.000-00"
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskTaxId}
                      maxDigits={14}
                    />
                  )}
                />
              </Field>

              <Field
                label="Tipo"
                htmlFor="type"
                error={form.formState.errors.type?.message}
                className="md:col-span-2"
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
                        <SelectItem value="goods">Mercadoria</SelectItem>
                        <SelectItem value="service">Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <div className="md:col-span-2">
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
                label="Nome"
                htmlFor="name"
                error={form.formState.errors.name?.message}
                className="md:col-span-6"
              >
                <Input id="name" {...form.register('name')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Endereço</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field
                label="CEP"
                htmlFor="zipCode"
                error={form.formState.errors.zipCode?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <MaskedInput
                      id="zipCode"
                      placeholder="00000-000"
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskCep}
                      maxDigits={8}
                    />
                  )}
                />
              </Field>

              <Field label="Cidade" htmlFor="city" className="md:col-span-4">
                <Input id="city" {...form.register('city')} />
              </Field>

              <Field label="Endereço" htmlFor="address" className="md:col-span-4">
                <Input id="address" {...form.register('address')} />
              </Field>

              <Field label="Bairro" htmlFor="neighborhood" className="md:col-span-2">
                <Input id="neighborhood" {...form.register('neighborhood')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Contato</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Contato" htmlFor="contactName" className="md:col-span-2">
                <Input id="contactName" {...form.register('contactName')} />
              </Field>

              <Field
                label="Telefone"
                htmlFor="phone"
                error={form.formState.errors.phone?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <MaskedInput
                      id="phone"
                      placeholder="(11) 3333-4444"
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskPhone}
                      maxDigits={11}
                    />
                  )}
                />
              </Field>

              <Field
                label="Celular"
                htmlFor="mobile"
                error={form.formState.errors.mobile?.message}
                className="md:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <MaskedInput
                      id="mobile"
                      placeholder="(11) 99999-9999"
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskPhone}
                      maxDigits={11}
                    />
                  )}
                />
              </Field>
            </div>
          </section>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" disabled={mutation.isPending}>
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

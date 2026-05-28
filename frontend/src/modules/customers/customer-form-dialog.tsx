import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  customersApi,
  type CreateCustomerPayload,
  type UpdateCustomerPayload,
} from '@/services/customers-api'
import { getErrorMessage } from '@/lib/errors'
import { maskCep, maskCnpj, maskCpf, maskPhone, onlyDigits } from '@/lib/masks'
import { isValidCnpj, isValidCpf } from '@/lib/tax-id'
import type { Customer, CustomerType } from '@/types/api'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = z
  .object({
    type: z.enum(['individual', 'company'], { message: 'Selecione o tipo.' }),
    legalName: z.string().trim().min(1, 'Nome / razão social é obrigatório.').max(160),
    tradeName: z.string().trim().max(160).optional().or(z.literal('')),
    taxId: z.string(),
    address: z.string().trim().max(160).optional().or(z.literal('')),
    addressNumber: z.string().trim().max(20).optional().or(z.literal('')),
    addressComplement: z.string().trim().max(80).optional().or(z.literal('')),
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
    email: z
      .string()
      .trim()
      .max(160)
      .refine((v) => v === '' || EMAIL_RE.test(v), 'E-mail inválido.'),
    customerSince: z.string().optional().or(z.literal('')),
    contactName: z.string().trim().max(120).optional().or(z.literal('')),
    isActive: z.boolean(),
    isInternal: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const digits = values.taxId
    if (values.type === 'individual') {
      if (digits.length !== 11) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxId'],
          message: 'CPF deve conter 11 dígitos.',
        })
      } else if (!isValidCpf(digits)) {
        ctx.addIssue({ code: 'custom', path: ['taxId'], message: 'CPF inválido.' })
      }
    } else {
      if (digits.length !== 14) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxId'],
          message: 'CNPJ deve conter 14 dígitos.',
        })
      } else if (!isValidCnpj(digits)) {
        ctx.addIssue({ code: 'custom', path: ['taxId'], message: 'CNPJ inválido.' })
      }
    }
  })

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    type: 'company',
    legalName: '',
    tradeName: '',
    taxId: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    zipCode: '',
    phone: '',
    mobile: '',
    email: '',
    customerSince: '',
    contactName: '',
    isActive: true,
    isInternal: false,
  }
}

function toFormValues(customer: Customer): FormValues {
  return {
    type: customer.type,
    legalName: customer.legalName,
    tradeName: customer.tradeName ?? '',
    taxId: onlyDigits(customer.taxId),
    address: customer.address ?? '',
    addressNumber: customer.addressNumber ?? '',
    addressComplement: customer.addressComplement ?? '',
    neighborhood: customer.neighborhood ?? '',
    city: customer.city ?? '',
    zipCode: onlyDigits(customer.zipCode),
    phone: onlyDigits(customer.phone),
    mobile: onlyDigits(customer.mobile),
    email: customer.email ?? '',
    customerSince: customer.customerSince ?? '',
    contactName: customer.contactName ?? '',
    isActive: customer.isActive,
    isInternal: customer.isInternal,
  }
}

function toPayload(values: FormValues): CreateCustomerPayload {
  const trimmed = (v: string) => v.trim()
  return {
    type: values.type,
    legalName: trimmed(values.legalName),
    tradeName: values.type === 'company' ? trimmed(values.tradeName ?? '') || undefined : undefined,
    taxId: values.taxId,
    address: trimmed(values.address ?? '') || undefined,
    addressNumber: trimmed(values.addressNumber ?? '') || undefined,
    addressComplement: trimmed(values.addressComplement ?? '') || undefined,
    neighborhood: trimmed(values.neighborhood ?? '') || undefined,
    city: trimmed(values.city ?? '') || undefined,
    zipCode: values.zipCode || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    email: trimmed(values.email ?? '') || undefined,
    customerSince: values.customerSince || undefined,
    contactName: trimmed(values.contactName ?? '') || undefined,
    isActive: values.isActive,
    isInternal: values.isInternal,
  }
}

interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

/**
 * Create / edit a customer of the active company. Modal layout chosen by
 * product even though there are 17 fields — they are grouped in 4 sections to
 * keep the form digestible. The Identification section reacts to the Tipo
 * field: PF hides nome fantasia and uses CPF mask; PJ shows both names and
 * uses CNPJ mask.
 */
export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const isEdit = Boolean(customer)
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  const type = useWatch({ control: form.control, name: 'type' }) as CustomerType

  useEffect(() => {
    if (!open) return
    form.reset(customer ? toFormValues(customer) : emptyValues())
  }, [open, customer, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && customer) {
        return customersApi.update(customer.id, payload satisfies UpdateCustomerPayload)
      }
      return customersApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const taxIdMask = type === 'company' ? maskCnpj : maskCpf
  const taxIdMaxDigits = type === 'company' ? 14 : 11
  const taxIdPlaceholder = type === 'company' ? '00.000.000/0000-00' : '000.000.000-00'
  const legalNameLabel = type === 'company' ? 'Razão social' : 'Nome completo'

  function handleTypeChange(value: string) {
    const next = value as CustomerType
    if (next !== type) {
      // Clear taxId when switching PF↔PJ — its digit count would no longer match.
      form.setValue('taxId', '', { shouldValidate: false })
      if (next === 'individual') {
        form.setValue('tradeName', '', { shouldValidate: false })
      }
    }
    form.setValue('type', next, { shouldValidate: false })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>

        <form
          id="customer-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-6"
        >
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Identificação
            </h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field
                label="Tipo"
                htmlFor="type"
                error={form.formState.errors.type?.message}
                className="md:col-span-2"
              >
                <Select value={type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Pessoa física</SelectItem>
                    <SelectItem value="company">Pessoa jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

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
                      placeholder={taxIdPlaceholder}
                      value={field.value}
                      onChange={field.onChange}
                      mask={taxIdMask}
                      maxDigits={taxIdMaxDigits}
                    />
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
                label={legalNameLabel}
                htmlFor="legalName"
                error={form.formState.errors.legalName?.message}
                className={type === 'company' ? 'md:col-span-3' : 'md:col-span-6'}
              >
                <Input id="legalName" {...form.register('legalName')} />
              </Field>

              {type === 'company' && (
                <Field
                  label="Nome fantasia"
                  htmlFor="tradeName"
                  error={form.formState.errors.tradeName?.message}
                  className="md:col-span-3"
                >
                  <Input id="tradeName" {...form.register('tradeName')} />
                </Field>
              )}
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

              <Field label="Cidade" htmlFor="city" className="md:col-span-2">
                <Input id="city" {...form.register('city')} />
              </Field>

              <Field label="Bairro" htmlFor="neighborhood" className="md:col-span-2">
                <Input id="neighborhood" {...form.register('neighborhood')} />
              </Field>

              <Field label="Endereço" htmlFor="address" className="md:col-span-4">
                <Input id="address" {...form.register('address')} />
              </Field>

              <Field label="Número" htmlFor="addressNumber" className="md:col-span-1">
                <Input id="addressNumber" {...form.register('addressNumber')} />
              </Field>

              <Field
                label="Complemento"
                htmlFor="addressComplement"
                className="md:col-span-1"
              >
                <Input id="addressComplement" {...form.register('addressComplement')} />
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

              <Field
                label="E-mail"
                htmlFor="email"
                error={form.formState.errors.email?.message}
                className="md:col-span-6"
              >
                <Input id="email" type="email" {...form.register('email')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Dados do cliente
            </h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Cliente desde" htmlFor="customerSince" className="md:col-span-2">
                <Input id="customerSince" type="date" {...form.register('customerSince')} />
              </Field>

              <div className="md:col-span-4">
                <Controller
                  control={form.control}
                  name="isInternal"
                  render={({ field }) => (
                    <div className="flex h-full items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="isInternal" className="text-sm">
                          Cliente interno da oficina
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Marque quando este cadastro representa a própria oficina.
                        </p>
                      </div>
                      <Switch
                        id="isInternal"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
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
          <Button type="submit" form="customer-form" disabled={mutation.isPending}>
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

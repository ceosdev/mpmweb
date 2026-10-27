import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { employeesApi, type EmployeePayload } from '@/services/employees-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { todayIso } from '@/lib/format'
import { maskCep, maskCpf, maskPhone, onlyDigits } from '@/lib/masks'
import { isValidCpf } from '@/lib/tax-id'
import type { Employee } from '@/types/api'
import { MaskedInput } from '@/components/form/masked-input'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const text = (max: number) => z.string().trim().max(max, `Deve ter no máximo ${max} caracteres.`)

const schema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório.').max(120),
    roleTitle: text(80),
    birthDate: z.string(),
    taxId: z
      .string()
      .refine((v) => v === '' || (v.length === 11 && isValidCpf(v)), 'CPF inválido.'),
    idNumber: text(20),
    workCard: text(30),
    pis: text(20),
    driverLicense: text(20),
    address: text(160),
    addressNumber: text(20),
    addressComplement: text(80),
    neighborhood: text(80),
    city: text(80),
    zipCode: z.string().refine((v) => v === '' || v.length === 8, 'CEP deve ter 8 dígitos.'),
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
    hiredAt: z.string(),
    terminatedAt: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    // ISO dates compare correctly as strings.
    if (values.birthDate && values.birthDate > todayIso()) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'A data de nascimento não pode ser futura.',
      })
    }
    if (values.hiredAt && values.terminatedAt && values.terminatedAt < values.hiredAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['terminatedAt'],
        message: 'A data de demissão não pode ser anterior à data de admissão.',
      })
    }
  })

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    name: '',
    roleTitle: '',
    birthDate: '',
    taxId: '',
    idNumber: '',
    workCard: '',
    pis: '',
    driverLicense: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    zipCode: '',
    phone: '',
    mobile: '',
    email: '',
    hiredAt: '',
    terminatedAt: '',
    isActive: true,
  }
}

function toFormValues(employee: Employee): FormValues {
  return {
    name: employee.name,
    roleTitle: employee.roleTitle ?? '',
    birthDate: employee.birthDate ?? '',
    taxId: onlyDigits(employee.taxId),
    idNumber: employee.idNumber ?? '',
    workCard: employee.workCard ?? '',
    pis: employee.pis ?? '',
    driverLicense: employee.driverLicense ?? '',
    address: employee.address ?? '',
    addressNumber: employee.addressNumber ?? '',
    addressComplement: employee.addressComplement ?? '',
    neighborhood: employee.neighborhood ?? '',
    city: employee.city ?? '',
    zipCode: onlyDigits(employee.zipCode),
    phone: onlyDigits(employee.phone),
    mobile: onlyDigits(employee.mobile),
    email: employee.email ?? '',
    hiredAt: employee.hiredAt ?? '',
    terminatedAt: employee.terminatedAt ?? '',
    isActive: employee.isActive,
  }
}

/** Empty → `null`, so an edit actually clears a field that had a value. */
function toPayload(values: FormValues): EmployeePayload {
  const orNull = (v: string) => v.trim() || null
  return {
    name: values.name.trim(),
    roleTitle: orNull(values.roleTitle),
    birthDate: orNull(values.birthDate),
    taxId: orNull(values.taxId),
    idNumber: orNull(values.idNumber),
    workCard: orNull(values.workCard),
    pis: orNull(values.pis),
    driverLicense: orNull(values.driverLicense),
    address: orNull(values.address),
    addressNumber: orNull(values.addressNumber),
    addressComplement: orNull(values.addressComplement),
    neighborhood: orNull(values.neighborhood),
    city: orNull(values.city),
    zipCode: orNull(values.zipCode),
    phone: orNull(values.phone),
    mobile: orNull(values.mobile),
    email: orNull(values.email),
    hiredAt: orNull(values.hiredAt),
    terminatedAt: orNull(values.terminatedAt),
    isActive: values.isActive,
  }
}

interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
}

/**
 * Create / edit an employee of the active company. Only the name is required;
 * the 20 fields are grouped in 5 sections, mirroring the customer form.
 * Status and termination date are independent: filling the termination date
 * does not deactivate the employee.
 */
export function EmployeeFormDialog({ open, onOpenChange, employee }: EmployeeFormDialogProps) {
  const isEdit = Boolean(employee)
  const queryClient = useQueryClient()
  const { tenant } = useAuth()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(employee ? toFormValues(employee) : emptyValues())
  }, [open, employee, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values)
      if (isEdit && employee) return employeesApi.update(employee.id, payload)
      return employeesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Funcionário atualizado.' : 'Funcionário cadastrado.')
      queryClient.invalidateQueries({ queryKey: ['employees', tenant?.companyId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const errors = form.formState.errors

  function masked(
    name: 'taxId' | 'zipCode' | 'phone' | 'mobile',
    mask: (raw: string) => string,
    maxDigits: number,
    placeholder: string
  ) {
    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <MaskedInput
            id={name}
            placeholder={placeholder}
            value={field.value}
            onChange={field.onChange}
            mask={mask}
            maxDigits={maxDigits}
          />
        )}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
        </DialogHeader>

        <form
          id="employee-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-6"
        >
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Identificação
            </h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Nome" htmlFor="name" error={errors.name?.message} className="md:col-span-6">
                <Input id="name" {...form.register('name')} />
              </Field>
              <Field
                label="Função"
                htmlFor="roleTitle"
                error={errors.roleTitle?.message}
                className="md:col-span-4"
              >
                <Input id="roleTitle" {...form.register('roleTitle')} />
              </Field>
              <Field
                label="Data de nascimento"
                htmlFor="birthDate"
                error={errors.birthDate?.message}
                className="md:col-span-2"
              >
                <Input id="birthDate" type="date" {...form.register('birthDate')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Documentos</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="CPF" htmlFor="taxId" error={errors.taxId?.message} className="md:col-span-2">
                {masked('taxId', maskCpf, 11, '000.000.000-00')}
              </Field>
              <Field label="RG" htmlFor="idNumber" error={errors.idNumber?.message} className="md:col-span-2">
                <Input id="idNumber" {...form.register('idNumber')} />
              </Field>
              <Field label="CTPS" htmlFor="workCard" error={errors.workCard?.message} className="md:col-span-2">
                <Input id="workCard" {...form.register('workCard')} />
              </Field>
              <Field label="PIS" htmlFor="pis" error={errors.pis?.message} className="md:col-span-3">
                <Input id="pis" {...form.register('pis')} />
              </Field>
              <Field
                label="CNH"
                htmlFor="driverLicense"
                error={errors.driverLicense?.message}
                className="md:col-span-3"
              >
                <Input id="driverLicense" {...form.register('driverLicense')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Endereço</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="CEP" htmlFor="zipCode" error={errors.zipCode?.message} className="md:col-span-2">
                {masked('zipCode', maskCep, 8, '00000-000')}
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
              <Field label="Complemento" htmlFor="addressComplement" className="md:col-span-1">
                <Input id="addressComplement" {...form.register('addressComplement')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Contato</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Telefone" htmlFor="phone" error={errors.phone?.message} className="md:col-span-3">
                {masked('phone', maskPhone, 11, '(11) 3333-4444')}
              </Field>
              <Field label="Celular" htmlFor="mobile" error={errors.mobile?.message} className="md:col-span-3">
                {masked('mobile', maskPhone, 11, '(11) 99999-9999')}
              </Field>
              <Field label="E-mail" htmlFor="email" error={errors.email?.message} className="md:col-span-6">
                <Input id="email" type="email" {...form.register('email')} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Contrato</h3>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Data de admissão" htmlFor="hiredAt" className="md:col-span-2">
                <Input id="hiredAt" type="date" {...form.register('hiredAt')} />
              </Field>
              <Field
                label="Data de demissão"
                htmlFor="terminatedAt"
                error={errors.terminatedAt?.message}
                className="md:col-span-2"
              >
                <Input id="terminatedAt" type="date" {...form.register('terminatedAt')} />
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
                      <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>
            </div>
          </section>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="employee-form" disabled={mutation.isPending}>
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

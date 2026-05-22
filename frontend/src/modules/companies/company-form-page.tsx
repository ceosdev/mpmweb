import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  companiesApi,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '@/services/companies-api'
import { resolveAssetUrl } from '@/services/api-client'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { maskCep, maskCnpj, maskPhone, onlyDigits } from '@/lib/masks'
import type { Company } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { FullPageLoader } from '@/components/full-page-loader'
import { MaskedInput } from '@/components/form/masked-input'
import { BRAZILIAN_STATES, StateSelect } from '@/components/form/state-select'
import { FileInput } from '@/components/form/file-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const LOGO_ACCEPT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const
const LOGO_ACCEPT_MIME =
  'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml'
const LOGO_MAX_SIZE = 2 * 1024 * 1024 // 2 MB

const schema = z.object({
  legalName: z.string().min(2, 'Razão social deve ter ao menos 2 caracteres.'),
  tradeName: z.string().max(180).optional().or(z.literal('')),
  // Raw digits in form state; empty string = unset.
  taxId: z
    .string()
    .refine((v) => v === '' || v.length === 14, 'CNPJ deve ter 14 dígitos.'),
  stateRegistration: z.string().max(30).optional().or(z.literal('')),
  municipalRegistration: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(180).optional().or(z.literal('')),
  addressNumber: z.string().max(20).optional().or(z.literal('')),
  neighborhood: z.string().max(120).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  zipCode: z
    .string()
    .refine((v) => v === '' || v.length === 8, 'CEP deve ter 8 dígitos.'),
  state: z
    .string()
    .refine(
      (v) => v === '' || (BRAZILIAN_STATES as readonly string[]).includes(v),
      'UF inválida.'
    ),
  phone: z
    .string()
    .refine(
      (v) => v === '' || v.length === 10 || v.length === 11,
      'Fone deve ter 10 ou 11 dígitos.'
    ),
  email: z
    .string()
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    legalName: '',
    tradeName: '',
    taxId: '',
    stateRegistration: '',
    municipalRegistration: '',
    address: '',
    addressNumber: '',
    neighborhood: '',
    city: '',
    zipCode: '',
    state: '',
    phone: '',
    email: '',
    isActive: true,
  }
}

function toFormValues(company: Company): FormValues {
  return {
    legalName: company.legalName,
    tradeName: company.tradeName ?? '',
    taxId: onlyDigits(company.taxId),
    stateRegistration: company.stateRegistration ?? '',
    municipalRegistration: company.municipalRegistration ?? '',
    address: company.address ?? '',
    addressNumber: company.addressNumber ?? '',
    neighborhood: company.neighborhood ?? '',
    city: company.city ?? '',
    zipCode: onlyDigits(company.zipCode),
    state: company.state ?? '',
    phone: onlyDigits(company.phone),
    email: company.email ?? '',
    isActive: company.isActive,
  }
}

function toPayload(values: FormValues): CreateCompanyPayload {
  const trimmed = (v: string) => v.trim()
  return {
    legalName: trimmed(values.legalName),
    tradeName: trimmed(values.tradeName ?? '') || undefined,
    taxId: values.taxId || undefined,
    stateRegistration: trimmed(values.stateRegistration ?? '') || undefined,
    municipalRegistration: trimmed(values.municipalRegistration ?? '') || undefined,
    address: trimmed(values.address ?? '') || undefined,
    addressNumber: trimmed(values.addressNumber ?? '') || undefined,
    neighborhood: trimmed(values.neighborhood ?? '') || undefined,
    city: trimmed(values.city ?? '') || undefined,
    zipCode: values.zipCode || undefined,
    state: values.state || undefined,
    phone: values.phone || undefined,
    email: trimmed(values.email ?? '') || undefined,
    isActive: values.isActive,
  }
}

/**
 * Create / edit a company. Lives at a dedicated route because the form has
 * 15 fields including an image upload (see crud-form-presentation rule).
 */
export function CompanyFormPage() {
  const { id } = useParams<{ id: string }>()
  const isCreating = !id || id === 'new'
  const companyId = isCreating ? null : Number(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const tenantId = tenant?.companyId

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['company', tenantId, companyId],
    queryFn: () => companiesApi.get(companyId!),
    enabled: !isCreating && companyId !== null,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (detailQuery.data) {
      form.reset(toFormValues(detailQuery.data))
      setLogoFile(null)
      setRemoveLogo(false)
    }
  }, [detailQuery.data, form])

  const currentLogoUrl = removeLogo
    ? null
    : resolveAssetUrl(detailQuery.data?.logoUrl ?? null)

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values)
      if (isCreating) {
        return companiesApi.create({ data: payload, logo: logoFile })
      }
      return companiesApi.update(companyId!, {
        data: payload as UpdateCompanyPayload,
        logo: logoFile,
        removeLogo: removeLogo && !logoFile,
      })
    },
    onSuccess: () => {
      toast.success(
        isCreating ? 'Empresa criada com sucesso.' : 'Empresa atualizada com sucesso.'
      )
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ['company', tenantId, companyId] })
      }
      navigate('/companies')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (!isCreating && detailQuery.isLoading) {
    return <FullPageLoader />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCreating ? 'Nova empresa' : 'Editar empresa'}
        description={
          isCreating
            ? 'Cadastre uma nova empresa na plataforma.'
            : 'Atualize os dados da empresa.'
        }
      >
        <Button variant="outline" asChild>
          <Link to="/companies">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <form
        id="company-form"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Identificação
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Razão social" htmlFor="legalName" error={form.formState.errors.legalName?.message} className="md:col-span-2">
              <Input id="legalName" {...form.register('legalName')} />
            </Field>

            <Field label="Nome fantasia" htmlFor="tradeName">
              <Input id="tradeName" {...form.register('tradeName')} />
            </Field>

            <Field label="CNPJ" htmlFor="taxId" error={form.formState.errors.taxId?.message}>
              <Controller
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <MaskedInput
                    id="taxId"
                    placeholder="00.000.000/0000-00"
                    value={field.value}
                    onChange={field.onChange}
                    mask={maskCnpj}
                    maxDigits={14}
                  />
                )}
              />
            </Field>

            <Field label="Inscrição estadual" htmlFor="stateRegistration">
              <Input id="stateRegistration" {...form.register('stateRegistration')} />
            </Field>

            <Field label="Inscrição municipal" htmlFor="municipalRegistration">
              <Input
                id="municipalRegistration"
                {...form.register('municipalRegistration')}
              />
            </Field>

            <div className="md:col-span-2">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Empresa ativa</Label>
                      <p className="text-xs text-muted-foreground">
                        Empresas inativas não podem ser acessadas.
                      </p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Endereço</h2>
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

            <Field
              label="UF"
              htmlFor="state"
              error={form.formState.errors.state?.message}
              className="md:col-span-1"
            >
              <Controller
                control={form.control}
                name="state"
                render={({ field }) => (
                  <StateSelect id="state" value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>

            <Field label="Cidade" htmlFor="city" className="md:col-span-3">
              <Input id="city" {...form.register('city')} />
            </Field>

            <Field label="Endereço" htmlFor="address" className="md:col-span-5">
              <Input id="address" {...form.register('address')} />
            </Field>

            <Field label="Número" htmlFor="addressNumber" className="md:col-span-1">
              <Input id="addressNumber" {...form.register('addressNumber')} />
            </Field>

            <Field label="Bairro" htmlFor="neighborhood" className="md:col-span-3">
              <Input id="neighborhood" {...form.register('neighborhood')} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Contato</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fone" htmlFor="phone" error={form.formState.errors.phone?.message}>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <MaskedInput
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={field.value}
                    onChange={field.onChange}
                    mask={maskPhone}
                    maxDigits={11}
                  />
                )}
              />
            </Field>

            <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" {...form.register('email')} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Logomarca</h2>
          <FileInput
            value={logoFile}
            onChange={(file) => {
              setLogoFile(file)
              if (file) setRemoveLogo(false)
            }}
            currentUrl={currentLogoUrl}
            onRemoveCurrent={() => setRemoveLogo(true)}
            accept={LOGO_ACCEPT_MIME}
            acceptExtensions={LOGO_ACCEPT_EXTENSIONS}
            maxSize={LOGO_MAX_SIZE}
          />
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/companies">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </div>
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

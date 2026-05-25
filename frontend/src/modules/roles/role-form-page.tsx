import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { rolesApi, type CreateRolePayload, type UpdateRolePayload } from '@/services/roles-api'
import { catalogApi } from '@/services/catalog-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Permission, Role } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { FullPageLoader } from '@/components/full-page-loader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const SLUG_REGEX = /^[a-z][a-z0-9_-]*$/

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  companies: 'Empresas',
  users: 'Usuários',
  permissions: 'Permissões',
  roles: 'Perfis',
  payment_types: 'Tipos de pagamento',
  document_types: 'Tipos de documento',
  units_of_measure: 'Unidades de medida',
  service_groups: 'Grupos de serviço',
  product_groups: 'Grupos de produto',
  product_subgroups: 'Subgrupos de produto',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(80, 'Máximo 80 caracteres.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug é obrigatório.')
    .max(40, 'Máximo 40 caracteres.')
    .regex(
      SLUG_REGEX,
      'Use apenas letras minúsculas, números, "-" ou "_" (começando por letra).'
    )
    .refine((v) => v !== 'root', 'O slug "root" é reservado.'),
  description: z.string().trim().max(255, 'Máximo 255 caracteres.').optional().or(z.literal('')),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return { name: '', slug: '', description: '', isActive: true }
}

function toFormValues(role: Role): FormValues {
  return {
    name: role.name,
    slug: role.slug,
    description: role.description ?? '',
    isActive: role.isActive,
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
}

/**
 * Create / edit a role of the active company. Lives at a dedicated route
 * because besides the metadata it carries a permission selector grouped by
 * module (see spec 007).
 */
export function RoleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isCreating = !id || id === 'new'
  const roleId = isCreating ? null : Number(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tenant } = useAuth()
  const tenantId = tenant?.companyId

  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])

  const detailQuery = useQuery({
    queryKey: ['role', tenantId, roleId],
    queryFn: () => rolesApi.get(roleId!),
    enabled: !isCreating && roleId !== null,
  })

  const permissionsQuery = useQuery({
    queryKey: ['permissions', tenantId],
    queryFn: catalogApi.permissions,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (detailQuery.data) {
      form.reset(toFormValues(detailQuery.data))
      setSelectedPermissions(detailQuery.data.permissions?.map((p) => p.id) ?? [])
    }
  }, [detailQuery.data, form])

  // Slug is derived from the name field — the user never edits it directly.
  const nameValue = form.watch('name')
  useEffect(() => {
    form.setValue('slug', slugify(nameValue ?? ''), { shouldValidate: true })
  }, [nameValue, form])

  const grouped = useMemo(() => {
    const map: Record<string, Permission[]> = {}
    for (const permission of permissionsQuery.data ?? []) {
      ;(map[permission.module] ??= []).push(permission)
    }
    return Object.entries(map).sort(([a], [b]) => {
      const la = MODULE_LABELS[a] ?? a
      const lb = MODULE_LABELS[b] ?? b
      return la.localeCompare(lb)
    })
  }, [permissionsQuery.data])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CreateRolePayload | UpdateRolePayload = {
        name: values.name,
        slug: values.slug,
        description: values.description?.trim() || undefined,
        isActive: values.isActive,
        permissions: selectedPermissions,
      }
      if (isCreating) {
        return rolesApi.create(payload as CreateRolePayload)
      }
      return rolesApi.update(roleId!, payload)
    },
    onSuccess: () => {
      toast.success(isCreating ? 'Perfil criado.' : 'Perfil atualizado.')
      queryClient.invalidateQueries({ queryKey: ['roles-list'] })
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] })
      if (roleId) {
        queryClient.invalidateQueries({ queryKey: ['role', tenantId, roleId] })
      }
      navigate('/roles')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function toggleOne(id: number) {
    setSelectedPermissions((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }

  function toggleAllOfModule(items: Permission[]) {
    const ids = items.map((p) => p.id)
    setSelectedPermissions((current) => {
      const all = ids.every((x) => current.includes(x))
      if (all) return current.filter((x) => !ids.includes(x))
      const merged = new Set([...current, ...ids])
      return Array.from(merged)
    })
  }

  if (!isCreating && detailQuery.isLoading) {
    return <FullPageLoader />
  }

  const totalPermissions = permissionsQuery.data?.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCreating ? 'Novo perfil' : 'Editar perfil'}
        description={
          isCreating
            ? 'Cadastre um novo perfil e selecione as permissões.'
            : 'Atualize o perfil e suas permissões.'
        }
      >
        <Button variant="outline" asChild>
          <Link to="/roles">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <form
        id="role-form"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Identificação
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nome"
              htmlFor="name"
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register('name')} />
            </Field>

            <Field
              label="Slug"
              htmlFor="slug"
              error={form.formState.errors.slug?.message}
              hint="Gerado automaticamente a partir do nome."
            >
              <Input
                id="slug"
                value={form.watch('slug')}
                readOnly
                disabled
                className="bg-muted/40"
              />
            </Field>

            <Field
              label="Descrição"
              htmlFor="description"
              error={form.formState.errors.description?.message}
              className="md:col-span-2"
            >
              <Input id="description" {...form.register('description')} />
            </Field>

            <div className="md:col-span-2">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Perfil ativo</Label>
                      <p className="text-xs text-muted-foreground">
                        Perfis inativos não aparecem ao atribuir um usuário a uma empresa.
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Permissões
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedPermissions.length} / {totalPermissions} selecionadas
            </span>
          </div>

          {permissionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma permissão disponível no catálogo.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {grouped.map(([module, items]) => {
                const ids = items.map((p) => p.id)
                const selectedCount = ids.filter((x) =>
                  selectedPermissions.includes(x)
                ).length
                const allSelected = selectedCount === ids.length
                const noneSelected = selectedCount === 0
                return (
                  <div
                    key={module}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {MODULE_LABELS[module] ?? module}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCount} / {ids.length} selecionadas
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAllOfModule(items)}
                      >
                        {allSelected ? 'Desmarcar todas' : 'Marcar todas'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((permission) => {
                        const selected = selectedPermissions.includes(permission.id)
                        return (
                          <button
                            key={permission.id}
                            type="button"
                            onClick={() => toggleOne(permission.id)}
                            className={cn(
                              'rounded-md border px-2 py-1 text-xs transition-colors',
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent'
                            )}
                            title={permission.description ?? permission.slug}
                          >
                            {permission.name}
                          </button>
                        )
                      })}
                    </div>
                    {noneSelected && (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma permissão deste módulo selecionada.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/roles">Cancelar</Link>
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
  hint?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

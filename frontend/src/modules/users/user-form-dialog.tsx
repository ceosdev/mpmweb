import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Download, Info, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  usersApi,
  type CreateUserPayload,
  type ImportUserPayload,
  type UpdateUserPayload,
} from '@/services/users-api'
import { getErrorMessage } from '@/lib/errors'
import { moduleLabel } from '@/permissions/module-labels'
import { usePermissions } from '@/permissions/use-permissions'
import type { ImportableUser, Permission, Role, UserDetail } from '@/types/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImportUserDialog } from '@/modules/users/import-user-dialog'

const schema = z.object({
  name: z.string().min(2, 'Informe o nome completo.'),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  password: z.string().optional(),
  roleId: z.string().min(1, 'Selecione o perfil.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The user being edited, or `null` to create a new one. */
  user: UserDetail | null
  roles: Role[]
  permissions: Permission[]
  /** Whether the current user may grant extra permissions. */
  canManagePermissions: boolean
}

/**
 * Create / edit a user of the active company. Besides the role, it allows
 * granting extra permissions on top of the role (`permissions.manage`).
 */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  permissions,
  canManagePermissions,
}: UserFormDialogProps) {
  const isEdit = Boolean(user)
  const isRootTarget = Boolean(user?.isRoot)
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [importing, setImporting] = useState<{
    user: ImportableUser
    sourceCompanyName: string
  } | null>(null)
  const [importerOpen, setImporterOpen] = useState(false)
  const canImport = can('users.import')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', roleId: '', isActive: true },
  })

  useEffect(() => {
    if (!open) return
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      roleId: user?.role ? String(user.role.id) : '',
      isActive: user?.isActive ?? true,
    })
    setSelectedPermissions(user?.extraPermissions.map((p) => p.id) ?? [])
    setExtrasOpen(false)
    setImporting(null)
    setImporterOpen(false)
  }, [open, user, reset])

  // Quando um usuário é escolhido no ImportUserDialog, entra em "modo importação":
  // pré-preenche nome/e-mail (que ficarão desabilitados), oculta o campo senha,
  // mantém perfil/ativo/extras como no fluxo normal.
  function onPickImport(picked: ImportableUser, sourceCompanyName: string) {
    setImporting({ user: picked, sourceCompanyName })
    setImporterOpen(false)
    reset({
      name: picked.name,
      email: picked.email,
      password: '',
      roleId: '',
      isActive: true,
    })
    setSelectedPermissions([])
    setExtrasOpen(false)
  }

  // Cancela a importação e volta o modal ao modo "criar do zero".
  function cancelImport() {
    setImporting(null)
    reset({ name: '', email: '', password: '', roleId: '', isActive: true })
    setSelectedPermissions([])
    setExtrasOpen(false)
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (importing) {
        const payload: ImportUserPayload = {
          userId: importing.user.id,
          roleId: Number(values.roleId),
          isActive: values.isActive,
          extraPermissions: selectedPermissions,
        }
        return usersApi.import(payload)
      }
      if (isEdit && user) {
        const payload: UpdateUserPayload = {
          name: values.name,
          roleId: Number(values.roleId),
          isActive: values.isActive,
          extraPermissions: selectedPermissions,
        }
        if (values.password) payload.password = values.password
        return usersApi.update(user.id, payload)
      }
      const payload: CreateUserPayload = {
        name: values.name,
        email: values.email,
        password: values.password ?? '',
        roleId: Number(values.roleId),
        isActive: values.isActive,
        extraPermissions: selectedPermissions,
      }
      return usersApi.create(payload)
    },
    onSuccess: () => {
      if (importing) {
        toast.success(`Usuário ${importing.user.name} importado para esta empresa.`)
      } else {
        toast.success(isEdit ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function onSubmit(values: FormValues) {
    // No modo importação a senha é ignorada — o User existente mantém a dele.
    if (!importing) {
      const password = values.password ?? ''
      if (!isEdit && password.length < 8) {
        setError('password', { message: 'A senha deve ter ao menos 8 caracteres.' })
        return
      }
      if (isEdit && password.length > 0 && password.length < 8) {
        setError('password', { message: 'A senha deve ter ao menos 8 caracteres.' })
        return
      }
    }
    mutation.mutate(values)
  }

  function togglePermission(id: number) {
    setSelectedPermissions((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id]
    )
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    ;(acc[permission.module] ??= []).push(permission)
    return acc
  }, {})

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar usuário' : importing ? 'Importar usuário' : 'Novo usuário'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados e o acesso deste usuário.'
              : importing
                ? 'Confira os dados e escolha o perfil que ele terá nesta empresa.'
                : 'Cadastre um usuário e vincule-o à empresa ativa.'}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && !importing && canImport && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setImporterOpen(true)}
          >
            <Download className="size-4" />
            Importar usuário de outra empresa
          </Button>
        )}

        {importing && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex-1 space-y-1">
              <p>
                Importando <span className="font-medium">{importing.user.name}</span> da empresa{' '}
                <span className="font-medium">{importing.sourceCompanyName}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Nome, e-mail e senha do usuário não podem ser alterados aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelImport}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Cancelar importação"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              disabled={Boolean(importing)}
              className={cn(importing && 'bg-muted/40')}
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              disabled={isEdit || Boolean(importing)}
              className={cn(importing && 'bg-muted/40')}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {!importing && (
            <div className="space-y-2">
              <Label htmlFor="password">{isEdit ? 'Nova senha (opcional)' : 'Senha'}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}

          {!isRootTarget && (
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId && (
                <p className="text-xs text-destructive">{errors.roleId.message}</p>
              )}
            </div>
          )}

          {!isRootTarget && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Usuário ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários inativos não conseguem acessar a empresa.
                    </p>
                  </div>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
          )}

          {canManagePermissions && !isRootTarget && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setExtrasOpen((open) => !open)}
                aria-expanded={extrasOpen}
                aria-controls="extra-permissions"
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {selectedPermissions.length > 0
                    ? 'Permissões extras'
                    : 'Adicionar permissões extras'}
                  {selectedPermissions.length > 0 && (
                    <Badge variant="secondary">
                      {selectedPermissions.length}{' '}
                      {selectedPermissions.length === 1 ? 'extra' : 'extras'}
                    </Badge>
                  )}
                </span>
                {extrasOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
              {extrasOpen && (
                <div id="extra-permissions" className="space-y-3 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Concedidas além das permissões do perfil selecionado.
                  </p>
                  {Object.entries(grouped).map(([module, items]) => (
                    <div key={module} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {moduleLabel(module)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((permission) => {
                          const selected = selectedPermissions.includes(permission.id)
                          return (
                            <button
                              key={permission.id}
                              type="button"
                              onClick={() => togglePermission(permission.id)}
                              className={cn(
                                'rounded-md border px-2 py-1 text-xs transition-colors',
                                selected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-accent'
                              )}
                            >
                              {permission.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ImportUserDialog
      open={importerOpen}
      onOpenChange={setImporterOpen}
      onSelect={onPickImport}
    />
    </>
  )
}

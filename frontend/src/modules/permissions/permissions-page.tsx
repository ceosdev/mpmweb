import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/services/catalog-api'
import { useAuth } from '@/providers/auth-provider'
import type { Permission } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  companies: 'Empresas',
  users: 'Usuários',
  permissions: 'Permissões',
}

/**
 * Read-only view of the RBAC model: the roles and the permission catalog.
 * The actual assignment of extra permissions happens on the user form.
 */
export function PermissionsPage() {
  const { tenant } = useAuth()

  const rolesQuery = useQuery({
    queryKey: ['roles', tenant?.companyId],
    queryFn: catalogApi.roles,
  })

  const permissionsQuery = useQuery({
    queryKey: ['permissions', tenant?.companyId],
    queryFn: catalogApi.permissions,
  })

  const grouped = (permissionsQuery.data ?? []).reduce<Record<string, Permission[]>>(
    (acc, permission) => {
      ;(acc[permission.module] ??= []).push(permission)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissões"
        description="Perfis de acesso e catálogo de permissões da plataforma."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {rolesQuery.isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))
          : (rolesQuery.data ?? []).map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <Badge variant="secondary">{role.permissions?.length ?? 0} permissões</Badge>
                  </div>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {(role.permissions ?? []).map((permission) => (
                    <Badge key={permission.id} variant="outline" className="font-normal">
                      {permission.name}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo de permissões</CardTitle>
          <CardDescription>Todas as permissões disponíveis, agrupadas por módulo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {permissionsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            Object.entries(grouped).map(([module, items]) => (
              <div key={module} className="space-y-2">
                <p className="text-sm font-medium">{MODULE_LABELS[module] ?? module}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((permission) => (
                    <div key={permission.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{permission.name}</p>
                        <code className="text-xs text-muted-foreground">{permission.slug}</code>
                      </div>
                      {permission.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

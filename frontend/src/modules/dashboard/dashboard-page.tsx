import { useQuery } from '@tanstack/react-query'
import { Building2, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { dashboardApi } from '@/services/dashboard-api'
import { useAuth } from '@/providers/auth-provider'
import type { DashboardStats } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const CARDS = [
  { key: 'activeUsers', label: 'Usuários ativos', icon: Users },
  { key: 'companies', label: 'Empresas', icon: Building2 },
  { key: 'roles', label: 'Perfis', icon: ShieldCheck },
  { key: 'permissions', label: 'Permissões', icon: KeyRound },
] satisfies { key: keyof DashboardStats; label: string; icon: typeof Users }[]

/**
 * Landing page — high-level metrics for the active company.
 */
export function DashboardPage() {
  const { tenant, user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', tenant?.companyId],
    queryFn: dashboardApi.stats,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${user?.name.split(' ')[0] ?? ''}`}
        description={`Visão geral de ${tenant?.company.tradeName ?? tenant?.company.legalName ?? ''}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-semibold tracking-tight">{data?.[card.key] ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bem-vindo à plataforma</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use o menu lateral para gerenciar usuários, empresas e permissões. O menu e as ações
          disponíveis variam conforme o seu perfil e a empresa ativa.
        </CardContent>
      </Card>
    </div>
  )
}

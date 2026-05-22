import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Building2, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'

/**
 * Company picker shown after login when the user belongs to more than one
 * company (or when no company is active yet).
 */
export function SelectCompanyPage() {
  const { companies, selectCompany, logout } = useAuth()
  const navigate = useNavigate()
  const [pendingId, setPendingId] = useState<number | null>(null)

  async function choose(companyId: number) {
    setPendingId(companyId)
    try {
      await selectCompany(companyId)
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
      setPendingId(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">MPM Web</span>
      </div>

      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Selecione a empresa</h1>
          <p className="text-sm text-muted-foreground">
            Escolha em qual empresa deseja trabalhar.
          </p>
        </div>

        {companies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Seu usuário não está vinculado a nenhuma empresa. Contate um administrador.
          </p>
        ) : (
          <div className="space-y-2">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => choose(company.id)}
                disabled={pendingId !== null}
                className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </span>
                <span className="flex-1 truncate">
                  <span className="block truncate text-sm font-medium">
                    {company.tradeName ?? company.legalName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {company.legalName}
                  </span>
                </span>
                {pendingId === company.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        )}

        <Button variant="ghost" className="w-full" onClick={() => void logout()}>
          Sair
        </Button>
      </div>
    </div>
  )
}

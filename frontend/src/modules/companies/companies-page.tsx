import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { companiesApi } from '@/services/companies-api'
import { resolveAssetUrl } from '@/services/api-client'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { maskTaxId } from '@/lib/masks'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PER_PAGE = 20

/**
 * Companies module — CRUD gated by RBAC. Root users see every company;
 * other roles only see the company they are in.
 */
export function CompaniesPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['companies', companyId, debouncedSearch, page, sort],
    queryFn: () =>
      companiesApi.list({
        search: debouncedSearch || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesApi.remove(id),
    onSuccess: () => {
      toast.success('Empresa removida.')
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const companies = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader title="Empresas" description="Gerencie as empresas da plataforma.">
        <Can permission="companies.create">
          <Button asChild>
            <Link to="/companies/new">
              <Plus className="size-4" />
              Nova empresa
            </Link>
          </Button>
        </Can>
      </PageHeader>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            description="Cadastre a primeira empresa da plataforma."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="legal_name" sort={sort} onSort={toggleSort}>
                  Empresa
                </SortableHeader>
                <SortableHeader column="tax_id" sort={sort} onSort={toggleSort}>
                  CNPJ
                </SortableHeader>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <SortableHeader column="created_at" sort={sort} onSort={toggleSort}>
                  Criada em
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const logoSrc = resolveAssetUrl(company.logoUrl)
                const initial = (company.tradeName ?? company.legalName).charAt(0).toUpperCase()
                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt=""
                              loading="lazy"
                              className="size-full object-contain"
                            />
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {initial}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{company.tradeName ?? company.legalName}</p>
                          <p className="text-xs text-muted-foreground">{company.legalName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.taxId ? maskTaxId(company.taxId) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.isActive ? 'default' : 'outline'}>
                        {company.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Can permission="companies.edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/companies/${company.id}/edit`)}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </Can>
                        <Can permission="companies.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(company.id)}
                            aria-label="Remover"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remover empresa"
        description="A empresa será desativada e deixará de aparecer nas listagens."
        confirmLabel="Remover"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { suppliersApi, type SupplierListParams } from '@/services/suppliers-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { maskCnpj, maskCpf, maskPhone, maskTaxId, onlyDigits } from '@/lib/masks'
import type { Supplier, SupplierType } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MaskedInput } from '@/components/form/masked-input'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { SupplierFormDialog } from '@/modules/suppliers/supplier-form-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PER_PAGE = 20

const TYPE_LABELS: Record<SupplierType, string> = {
  goods: 'Mercadoria',
  service: 'Serviço',
}

type TypeFilter = SupplierType | 'all'
type StatusFilter = 'all' | 'active' | 'inactive'

function maskCpfOrCnpj(raw: string): string {
  const d = onlyDigits(raw)
  if (d.length <= 11) return maskCpf(d)
  return maskCnpj(d)
}

/**
 * If there is no `phone`, fall back to `mobile` so the column is never empty
 * just because the user only filled in one of the two.
 */
function displayPhone(supplier: Supplier): string {
  const value = supplier.phone || supplier.mobile
  return value ? maskPhone(value) : '—'
}

export function SuppliersPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({
    name: '',
    taxId: '',
    type: 'all' as TypeFilter,
    status: 'all' as StatusFilter,
  })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listParams = useMemo<SupplierListParams>(
    () => ({
      name: filters.applied.name || undefined,
      taxId: filters.applied.taxId || undefined,
      type: filters.applied.type === 'all' ? undefined : filters.applied.type,
      status: filters.applied.status,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [filters.applied, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['suppliers', companyId, listParams],
    queryFn: () => suppliersApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => suppliersApi.remove(id),
    onSuccess: () => {
      toast.success('Fornecedor removido.')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Supplier) {
    setEditing(row)
    setFormOpen(true)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        description="Cadastre os fornecedores de mercadorias e serviços da empresa ativa."
      >
        <Can permission="suppliers.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo fornecedor
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome"
              value={filters.draft.name}
              onChange={(event) => filters.setField('name', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              className="w-64 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">CPF/CNPJ</label>
          <MaskedInput
            placeholder="Buscar por CPF/CNPJ"
            value={filters.draft.taxId}
            onChange={(value) => filters.setField('taxId', value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            mask={maskTaxId}
            maxDigits={14}
            className="block w-48"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select
            value={filters.draft.type}
            onValueChange={(value) => filters.setField('type', value as TypeFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="goods">Mercadoria</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.draft.status}
            onValueChange={(value) => filters.setField('status', value as StatusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SearchButton onClick={handleSearch} loading={listQuery.isFetching} />
        {filters.isDirty && (
          <Button variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={
              filters.isFiltered ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'
            }
            description={
              filters.isFiltered
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro fornecedor desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" sort={sort} onSort={toggleSort}>
                  Nome
                </SortableHeader>
                <SortableHeader column="tax_id" sort={sort} onSort={toggleSort}>
                  CPF/CNPJ
                </SortableHeader>
                <SortableHeader column="type" sort={sort} onSort={toggleSort}>
                  Tipo
                </SortableHeader>
                <SortableHeader column="city" sort={sort} onSort={toggleSort}>
                  Cidade
                </SortableHeader>
                <TableHead>Telefone</TableHead>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {maskCpfOrCnpj(row.taxId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[row.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.city || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{displayPhone(row)}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="suppliers.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="suppliers.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir fornecedor"
        description="Esta ação é permanente. Se o fornecedor já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}

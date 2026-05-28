import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { suppliersApi, type SupplierListParams } from '@/services/suppliers-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
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

  const [nameFilter, setNameFilter] = useState('')
  const [taxIdFilter, setTaxIdFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedName = useDebouncedValue(nameFilter)
  const debouncedTaxId = useDebouncedValue(taxIdFilter)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listParams = useMemo<SupplierListParams>(
    () => ({
      name: debouncedName || undefined,
      taxId: debouncedTaxId || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: statusFilter,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [debouncedName, debouncedTaxId, typeFilter, statusFilter, page, sort]
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

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setNameFilter('')
    setTaxIdFilter('')
    setTypeFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const hasFilters =
    nameFilter.length > 0 ||
    taxIdFilter.length > 0 ||
    typeFilter !== 'all' ||
    statusFilter !== 'all'

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
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
              value={nameFilter}
              onChange={(event) => {
                setNameFilter(event.target.value)
                resetPage()
              }}
              className="w-64 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">CPF/CNPJ</label>
          <MaskedInput
            placeholder="Buscar por CPF/CNPJ"
            value={taxIdFilter}
            onChange={(value) => {
              setTaxIdFilter(value)
              resetPage()
            }}
            mask={maskTaxId}
            maxDigits={14}
            className="w-48"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as TypeFilter)
              resetPage()
            }}
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
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as StatusFilter)
              resetPage()
            }}
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

        {hasFilters && (
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
            title={hasFilters ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            description={
              hasFilters
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

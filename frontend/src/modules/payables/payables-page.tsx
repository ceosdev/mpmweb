import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { payablesApi, type PayableListParams } from '@/services/payables-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/masks'
import { currentMonthRange, formatIsoDate } from '@/lib/format'
import type { Payable, PayableStatusFilter } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { EntityPicker } from '@/components/common/entity-picker'
import { MultiSelect, type MultiSelectOption } from '@/components/form/multi-select'
import { PayableFormDialog } from '@/modules/payables/payable-form-dialog'
import { PayableStatusBadge } from '@/modules/payables/payable-status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

/** "Vencido" é virtual: vence antes de hoje e ainda deve algo. */
const STATUS_OPTIONS: MultiSelectOption<PayableStatusFilter>[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'partially_paid', label: 'Pago parcial' },
  { value: 'paid', label: 'Pago' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'overdue', label: 'Vencido' },
]

export function PayablesPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Calculado uma vez, na montagem: o recorte default é o mês corrente.
  const [defaultRange] = useState(currentMonthRange)

  const [documentNumberFilter, setDocumentNumberFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)

  // Vencimento vem **marcado** por default; emissão, desmarcado.
  const [dueEnabled, setDueEnabled] = useState(true)
  const [dueFrom, setDueFrom] = useState(defaultRange.from)
  const [dueTo, setDueTo] = useState(defaultRange.to)

  const [issueEnabled, setIssueEnabled] = useState(false)
  const [issueFrom, setIssueFrom] = useState(defaultRange.from)
  const [issueTo, setIssueTo] = useState(defaultRange.to)

  // Nenhum selecionado = todos.
  const [statusFilter, setStatusFilter] = useState<PayableStatusFilter[]>([])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedDocumentNumber = useDebouncedValue(documentNumberFilter)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Payable | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  function resetPage() {
    setPage(1)
  }

  const listParams = useMemo<PayableListParams>(
    () => ({
      documentNumber: debouncedDocumentNumber || undefined,
      supplierId: supplierFilter ?? undefined,
      // Desmarcar o checkbox desativa o filtro — as datas nem são enviadas.
      dueFrom: dueEnabled ? dueFrom : undefined,
      dueTo: dueEnabled ? dueTo : undefined,
      issueFrom: issueEnabled ? issueFrom : undefined,
      issueTo: issueEnabled ? issueTo : undefined,
      statuses: statusFilter,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [
      debouncedDocumentNumber,
      supplierFilter,
      dueEnabled,
      dueFrom,
      dueTo,
      issueEnabled,
      issueFrom,
      issueTo,
      statusFilter,
      page,
      sort,
    ]
  )

  const listQuery = useQuery({
    queryKey: ['payables', companyId, listParams],
    queryFn: () => payablesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => payablesApi.remove(id),
    onSuccess: () => {
      toast.success('Título removido.')
      queryClient.invalidateQueries({ queryKey: ['payables'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Payable) {
    setEditing(row)
    setFormOpen(true)
  }

  /** Volta ao **default** (mês corrente por vencimento), não ao vazio. */
  function clearFilters() {
    setDocumentNumberFilter('')
    setSupplierFilter(null)
    setDueEnabled(true)
    setDueFrom(defaultRange.from)
    setDueTo(defaultRange.to)
    setIssueEnabled(false)
    setIssueFrom(defaultRange.from)
    setIssueTo(defaultRange.to)
    setStatusFilter([])
    setPage(1)
  }

  const hasFilters =
    documentNumberFilter.length > 0 ||
    supplierFilter !== null ||
    !dueEnabled ||
    dueFrom !== defaultRange.from ||
    dueTo !== defaultRange.to ||
    issueEnabled ||
    statusFilter.length > 0

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a pagar"
        description="Lance e acompanhe os títulos a pagar da empresa ativa."
        // O mesmo ícone do item de menu (Financeiro → Contas a pagar).
        icon={Receipt}
      >
        <Can permission="payables.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo título
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Número do título</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número"
              className="w-48 pl-9"
              value={documentNumberFilter}
              onChange={(event) => {
                setDocumentNumberFilter(event.target.value)
                resetPage()
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cedente</label>
          <div className="w-64">
            <EntityPicker
              source="supplier"
              value={supplierFilter}
              onChange={(value) => {
                setSupplierFilter(value)
                resetPage()
              }}
            />
          </div>
        </div>

        <DateRangeFilter
          id="due"
          label="Vencimento"
          enabled={dueEnabled}
          onEnabledChange={(value) => {
            setDueEnabled(value)
            resetPage()
          }}
          from={dueFrom}
          to={dueTo}
          onFromChange={(value) => {
            setDueFrom(value)
            resetPage()
          }}
          onToChange={(value) => {
            setDueTo(value)
            resetPage()
          }}
        />

        <DateRangeFilter
          id="issue"
          label="Emissão"
          enabled={issueEnabled}
          onEnabledChange={(value) => {
            setIssueEnabled(value)
            resetPage()
          }}
          from={issueFrom}
          to={issueTo}
          onFromChange={(value) => {
            setIssueFrom(value)
            resetPage()
          }}
          onToChange={(value) => {
            setIssueTo(value)
            resetPage()
          }}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          {/* O gatilho do MultiSelect é inline-flex; sem este bloco ele subiria
              para a mesma linha da label. */}
          <div className="w-44">
            <MultiSelect
              id="status"
              className="w-full"
              options={STATUS_OPTIONS}
              value={statusFilter}
              emptyLabel="Todos"
              onChange={(value) => {
                setStatusFilter(value)
                resetPage()
              }}
            />
          </div>
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
            icon={Receipt}
            title={hasFilters ? 'Nenhum título encontrado' : 'Nenhum título lançado'}
            description={
              hasFilters
                ? 'Tente ajustar os filtros da busca.'
                : 'Lance o primeiro título a pagar desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="document_number" sort={sort} onSort={toggleSort}>
                  Número
                </SortableHeader>
                <SortableHeader column="installment" sort={sort} onSort={toggleSort}>
                  Ordem
                </SortableHeader>
                <SortableHeader column="issue_date" sort={sort} onSort={toggleSort}>
                  Emissão
                </SortableHeader>
                <TableHead>Cedente</TableHead>
                <SortableHeader column="due_date" sort={sort} onSort={toggleSort}>
                  Vencimento
                </SortableHeader>
                {/* Ordena pela mesma expressão que exibe (o total), não por `amount`. */}
                <SortableHeader column="total" sort={sort} onSort={toggleSort}>
                  Valor
                </SortableHeader>
                <TableHead>Saldo</TableHead>
                <SortableHeader column="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.documentNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{row.installment}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatIsoDate(row.issueDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.supplierName || '—'}
                  </TableCell>
                  <TableCell>
                    {/* `isOverdue` vem resolvido do backend (fuso da aplicação). */}
                    <span className={cn(row.isOverdue && 'font-medium text-destructive')}>
                      {formatIsoDate(row.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>{formatCurrency(row.total)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrency(row.balance)}
                  </TableCell>
                  <TableCell>
                    <PayableStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="payables.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="payables.delete">
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

      <PayableFormDialog open={formOpen} onOpenChange={setFormOpen} payable={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir título"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}

/**
 * Intervalo de datas com checkbox de habilitação. Desmarcado, o filtro não é
 * enviado — as datas continuam à vista (e preservadas) apenas como memória do
 * que estava selecionado.
 */
function DateRangeFilter({
  id,
  label,
  enabled,
  onEnabledChange,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  id: string
  label: string
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-enabled`}
          checked={enabled}
          onCheckedChange={(checked) => onEnabledChange(checked === true)}
        />
        <Label htmlFor={`${id}-enabled`} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="w-36"
          disabled={!enabled}
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label={`${label} — de`}
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          className="w-36"
          disabled={!enabled}
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          aria-label={`${label} — até`}
        />
      </div>
    </div>
  )
}

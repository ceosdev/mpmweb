import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Eye,
  PackageMinus,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Undo2,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { goodsExitsApi } from '@/services/goods-exits-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { usePermissions } from '@/permissions/use-permissions'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/masks'
import { currentMonthRange, formatIsoDate } from '@/lib/format'
import type { GoodsExitListParams, GoodsExitStatus, GoodsExitType } from '@/types/api'
import { openPdf } from '@/lib/open-pdf'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { MultiSelect, type MultiSelectOption } from '@/components/form/multi-select'
import { GoodsExitStatusBadge } from '@/modules/goods-exits/goods-exit-status-badge'
import { FinalizeGoodsExitDialog } from '@/modules/goods-exits/finalize-goods-exit-dialog'
import { ToolExitActionDialog } from '@/modules/goods-exits/tool-exit-action-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const STATUS_OPTIONS: MultiSelectOption<GoodsExitStatus>[] = [
  { value: 'open', label: 'Aberta' },
  { value: 'finalized', label: 'Finalizada' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'returned', label: 'Devolvida' },
]

type ExitTypeFilter = 'all' | GoodsExitType

const EXIT_TYPE_LABELS: Record<GoodsExitType, string> = {
  normal: 'Saída normal',
  tool: 'Saída de ferramentas',
}

export function GoodsExitsPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { canAny } = usePermissions()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // A coluna "Ações" só aparece se o usuário tem ao menos uma das ações do menu.
  const canActOnRow = canAny([
    'goods_exits.view',
    'goods_exits.edit',
    'goods_exits.delete',
    'goods_exits.finalize',
    'goods_exits.deliver',
    'goods_exits.return',
  ])

  // Calculado uma vez, na montagem: o recorte default é o mês corrente.
  const [defaultRange] = useState(currentMonthRange)

  const filters = useSearchFilters({
    id: '',
    consumer: '',
    exitType: 'all' as ExitTypeFilter,
    // Data da operação vem **marcada** por default.
    operationEnabled: true,
    operationFrom: defaultRange.from,
    operationTo: defaultRange.to,
    // Nenhum selecionado = todas.
    statuses: [] as GoodsExitStatus[],
  })
  const [page, setPage] = useState(1)
  // `null`: sem ordenação explícita, o backend ordena por operação desc, id desc.
  const [sort, setSort] = useState<SortState | null>(null)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [finalizeId, setFinalizeId] = useState<number | null>(null)
  const [deliverId, setDeliverId] = useState<number | null>(null)
  const [returnId, setReturnId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }

  /** Volta ao **default** (operação no mês corrente), não ao vazio. */
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const listParams = useMemo<GoodsExitListParams>(() => {
    const applied = filters.applied
    return {
      id: applied.id ? Number(applied.id) : undefined,
      consumer: applied.consumer.trim() || undefined,
      exitType: applied.exitType === 'all' ? undefined : applied.exitType,
      // Desmarcar o checkbox desativa o filtro — as datas nem são enviadas.
      operationFrom: applied.operationEnabled ? applied.operationFrom : undefined,
      operationTo: applied.operationEnabled ? applied.operationTo : undefined,
      statuses: applied.statuses,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }
  }, [filters.applied, page, sort])

  const listQuery = useQuery({
    queryKey: ['goods-exits', companyId, listParams],
    queryFn: () => goodsExitsApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => goodsExitsApi.remove(id),
    onSuccess: () => {
      toast.success('Saída removida.')
      queryClient.invalidateQueries({ queryKey: ['goods-exits', companyId] })
      queryClient.invalidateQueries({ queryKey: ['goods-exit', companyId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saída de mercadoria"
        description="Registre e acompanhe as saídas de mercadoria e de ferramentas da empresa ativa."
        // O mesmo ícone do item de menu (Mercadoria → Saída de mercadoria).
        icon={PackageMinus}
      >
        <Can permission="goods_exits.create">
          <Button onClick={() => navigate('/goods-exits/new')}>
            <Plus className="size-4" />
            Nova saída
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Código</label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Código"
            value={filters.draft.id}
            onChange={(event) => filters.setField('id', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            className="w-24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Consumidor</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Funcionário ou ativo"
              className="w-56 pl-9"
              value={filters.draft.consumer}
              onChange={(event) => filters.setField('consumer', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Tipo de saída</label>
          <Select
            value={filters.draft.exitType}
            onValueChange={(value) => filters.setField('exitType', value as ExitTypeFilter)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="normal">{EXIT_TYPE_LABELS.normal}</SelectItem>
              <SelectItem value="tool">{EXIT_TYPE_LABELS.tool}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DateRangeFilter
          id="operation"
          label="Data da operação"
          enabled={filters.draft.operationEnabled}
          onEnabledChange={(value) => filters.setField('operationEnabled', value)}
          from={filters.draft.operationFrom}
          to={filters.draft.operationTo}
          onFromChange={(value) => filters.setField('operationFrom', value)}
          onToChange={(value) => filters.setField('operationTo', value)}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Status</label>
          <div className="w-44">
            <MultiSelect
              id="status"
              className="w-full"
              options={STATUS_OPTIONS}
              value={filters.draft.statuses}
              emptyLabel="Todas"
              onChange={(value) => filters.setField('statuses', value)}
            />
          </div>
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
            icon={PackageMinus}
            title={filters.isFiltered ? 'Nenhuma saída encontrada' : 'Nenhuma saída lançada'}
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Lance a primeira saída de mercadoria desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                <SortableHeader column="consumer" sort={sort} onSort={toggleSort}>
                  Consumidor
                </SortableHeader>
                <SortableHeader column="exit_type" sort={sort} onSort={toggleSort}>
                  Tipo
                </SortableHeader>
                <SortableHeader column="operation_date" sort={sort} onSort={toggleSort}>
                  Data operação
                </SortableHeader>
                <SortableHeader column="requested_value" sort={sort} onSort={toggleSort}>
                  Valor requisitado
                </SortableHeader>
                <SortableHeader column="consumed_value" sort={sort} onSort={toggleSort}>
                  Valor consumido
                </SortableHeader>
                <SortableHeader column="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isOpen = row.status === 'open'
                const isTool = row.exitType === 'tool'
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>
                      <div>{row.consumerName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{row.consumerLabel}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {EXIT_TYPE_LABELS[row.exitType]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatIsoDate(row.operationDate)}
                    </TableCell>
                    <TableCell>{formatCurrency(row.requestedValue)}</TableCell>
                    <TableCell>{formatCurrency(row.consumedValue)}</TableCell>
                    <TableCell>
                      <GoodsExitStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        {canActOnRow && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ações">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Can permission="goods_exits.view">
                                <DropdownMenuItem onClick={() => navigate(`/goods-exits/${row.id}`)}>
                                  <Eye className="size-4" />
                                  Visualizar
                                </DropdownMenuItem>
                              </Can>
                              {isOpen && (
                                <Can permission="goods_exits.edit">
                                  <DropdownMenuItem
                                    onClick={() => navigate(`/goods-exits/${row.id}/edit`)}
                                  >
                                    <Pencil className="size-4" />
                                    Editar
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {isOpen && !isTool && (
                                <Can permission="goods_exits.finalize">
                                  <DropdownMenuItem onClick={() => setFinalizeId(row.id)}>
                                    <CheckCircle2 className="size-4" />
                                    Finalizar
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {isOpen && isTool && (
                                <Can permission="goods_exits.deliver">
                                  <DropdownMenuItem onClick={() => setDeliverId(row.id)}>
                                    <Truck className="size-4" />
                                    Entregar
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {row.status === 'delivered' && isTool && (
                                <Can permission="goods_exits.return">
                                  <DropdownMenuItem onClick={() => setReturnId(row.id)}>
                                    <Undo2 className="size-4" />
                                    Devolver
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {!isOpen && (
                                <Can permission="goods_exits.view">
                                  <DropdownMenuItem
                                    onClick={() => void openPdf(() => goodsExitsApi.protocol(row.id))}
                                  >
                                    <Printer className="size-4" />
                                    Imprimir protocolo
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {isOpen && (
                                <Can permission="goods_exits.delete">
                                  <DropdownMenuItem
                                    onClick={() => setDeleteId(row.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </Can>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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

      <FinalizeGoodsExitDialog
        exitId={finalizeId}
        onOpenChange={(open) => !open && setFinalizeId(null)}
      />
      <ToolExitActionDialog
        action="deliver"
        exitId={deliverId}
        onOpenChange={(open) => !open && setDeliverId(null)}
      />
      <ToolExitActionDialog
        action="return"
        exitId={returnId}
        onOpenChange={(open) => !open && setReturnId(null)}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir saída"
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

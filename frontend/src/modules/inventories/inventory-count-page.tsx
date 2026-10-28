import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ClipboardList,
  Eye,
  EyeOff,
  Info,
  Lock,
  Printer,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { inventoriesApi } from '@/services/inventories-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { usePermissions } from '@/permissions/use-permissions'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatIsoDate } from '@/lib/format'
import { openPdf } from '@/lib/open-pdf'
import type { Inventory, InventoryItem } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CloseInventoryDialog } from '@/modules/inventories/close-inventory-dialog'
import { InventoryStatusBadge } from '@/modules/inventories/inventory-status-badge'
import {
  InventoryCountTable,
  type RowState,
} from '@/modules/inventories/inventory-count-table'
import { differenceOf } from '@/modules/inventories/count-quantity'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Mesmo texto do TOOLS_NOTICE do PDF (backend/app/services/pdf/inventory_count_sheet.ts). */
const TOOLS_NOTICE =
  'Conte só as ferramentas que estão na prateleira. As emprestadas a funcionários já saíram do estoque e voltam a somar quando forem devolvidas.'

type ViewFilter = 'all' | 'divergent' | 'uncounted'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Counter({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card className="px-4 py-3" data-testid={testId}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  )
}

/** Recalcula o que a gravação de um item muda no detalhe em cache. */
function patchItem(
  inv: Inventory,
  itemId: number,
  countedQuantity: string | null,
): Inventory {
  const items = (inv.items ?? []).map((it): InventoryItem => {
    if (it.id !== itemId) return it
    const next: InventoryItem = { ...it, countedQuantity }
    if (it.stockQuantity !== undefined) {
      // Detalhe revelado: refaz diferença e situação com a aritmética do servidor (4 casas).
      next.difference =
        countedQuantity === null ? null : differenceOf(countedQuantity, it.stockQuantity)
      next.state =
        countedQuantity === null
          ? 'uncounted'
          : /^-?0\.0000$/.test(next.difference!)
            ? 'match'
            : 'divergent'
    } else {
      next.state = countedQuantity === null ? 'uncounted' : 'counted'
    }
    return next
  })
  return { ...inv, items, countedCount: items.filter((i) => i.countedQuantity !== null).length }
}

export function InventoryCountPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const { can } = usePermissions()
  const queryClient = useQueryClient()

  const [revealChoice, setRevealChoice] = useState(false)
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})
  const [resetOpen, setResetOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [closeOpen, setCloseOpen] = useState(() => searchParams.get('close') === '1')

  const canCount = can('inventories.count')

  // Fechado sempre revela; no aberto vale a escolha do usuário.
  const query = useQuery({
    queryKey: ['inventories', companyId, id, { reveal: revealChoice }],
    queryFn: () => inventoriesApi.get(id, { reveal: revealChoice }),
    enabled: !!companyId && Number.isFinite(id),
    placeholderData: keepPreviousData,
  })
  const inventory = query.data
  const closed = inventory?.status === 'closed'
  const reveal = closed || revealChoice
  const isOpen = inventory?.status === 'open'
  const revealKey = ['inventories', companyId, id, { reveal: true }]

  const setRowState = (itemId: number, patch: RowState) =>
    setRowStates((s) => ({ ...s, [itemId]: { ...s[itemId], ...patch } }))

  const saveMutation = useMutation({
    mutationFn: ({ itemId, value }: { itemId: number; value: string | null }) =>
      inventoriesApi.updateItem(id, itemId, value),
    onMutate: ({ itemId }) => setRowState(itemId, { saving: true, error: undefined }),
    onSuccess: (_data, { itemId, value }) => {
      setRowState(itemId, { saving: false, error: undefined })
      // Troca só aquele item nos detalhes em cache (cego e revelado), sem refetch.
      for (const rv of [false, true]) {
        queryClient.setQueryData<Inventory>(['inventories', companyId, id, { reveal: rv }], (old) =>
          old ? patchItem(old, itemId, value) : old,
        )
      }
      queryClient.invalidateQueries({ queryKey: revealKey, refetchType: 'none' })
    },
    onError: (error, { itemId }) =>
      setRowState(itemId, { saving: false, error: getErrorMessage(error) }),
  })

  const save = async (item: InventoryItem, value: string | null) => {
    try {
      await saveMutation.mutateAsync({ itemId: item.id, value })
      return true
    } catch {
      return false
    }
  }

  const resetMutation = useMutation({
    mutationFn: () => inventoriesApi.resetCount(id),
    onSuccess: () => {
      toast.success('Contagem zerada.')
      setResetOpen(false)
      setRowStates({})
      queryClient.invalidateQueries({ queryKey: ['inventories', companyId, id] })
      queryClient.invalidateQueries({ queryKey: ['inventories', companyId, 'list'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const handleCloseOpenChange = (next: boolean) => {
    setCloseOpen(next)
    if (!next && searchParams.has('close')) {
      const params = new URLSearchParams(searchParams)
      params.delete('close')
      setSearchParams(params, { replace: true })
    }
  }

  const items = useMemo(() => inventory?.items ?? [], [inventory])
  const counts = useMemo(() => {
    const counted = items.filter((i) => i.countedQuantity !== null).length
    return {
      total: items.length,
      counted,
      uncounted: items.length - counted,
      divergent: items.filter((i) => i.state === 'divergent').length,
    }
  }, [items])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((i) => {
      if (term && !String(i.productId).includes(term) && !i.productDescription.toLowerCase().includes(term))
        return false
      if (reveal && viewFilter === 'divergent') return i.state === 'divergent'
      if (reveal && viewFilter === 'uncounted') return i.countedQuantity === null
      return true
    })
  }, [items, search, reveal, viewFilter])

  if (query.isLoading || !inventory) {
    if (query.isError) {
      return (
        <div className="space-y-6">
          <PageHeader title="Contagem do inventário" icon={ClipboardList} />
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(query.error)}</AlertDescription>
          </Alert>
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <PageHeader title="Contagem do inventário" icon={ClipboardList} />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Inventário fechado: backend já devolveu tudo; se a query cega ainda está em cache, usa o reveal.
  const hasStock = items.every((i) => i.stockQuantity !== undefined)
  const revealed = reveal && (hasStock || closed)
  const scope = inventory.groups.length
    ? inventory.groups.map((g) => g.description).join(', ')
    : 'Todos os grupos'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contagem do inventário"
        icon={ClipboardList}
        description="Lance a quantidade contada de cada produto."
      >
        <Button variant="outline" asChild>
          <Link to="/inventories">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Código">{inventory.id}</Field>
          <Field label="Data de abertura">{formatIsoDate(inventory.openingDate)}</Field>
          <Field label="Status">
            <InventoryStatusBadge status={inventory.status} />
          </Field>
          <Field label="Aberto por">{inventory.openedByName ?? '—'}</Field>
          <Field label="Abrangência">{scope}</Field>
          {closed && (
            <>
              <Field label="Data de fechamento">
                {inventory.closedAt ? formatDate(inventory.closedAt) : '—'}
              </Field>
              <Field label="Fechado por">{inventory.closedByName ?? '—'}</Field>
            </>
          )}
        </dl>
      </Card>

      <div className={`grid gap-3 ${revealed ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
        <Counter label="Itens" value={counts.total} testId="counter-items" />
        <Counter label="Contados" value={counts.counted} testId="counter-counted" />
        <Counter label="Não contados" value={counts.uncounted} testId="counter-uncounted" />
        {revealed && <Counter label="Divergentes" value={counts.divergent} testId="counter-divergent" />}
      </div>

      {inventory.hasTools && isOpen && (
        <Alert>
          <Info />
          <AlertDescription>{TOOLS_NOTICE}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código ou descrição"
          aria-label="Buscar por código ou descrição"
          className="w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {revealed && (
          <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
            <SelectTrigger className="w-48" aria-label="Filtrar itens">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="divergent">Só divergentes</SelectItem>
              <SelectItem value="uncounted">Só não contados</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isOpen && (
            <Can permission="inventories.view">
              <Button variant="outline" onClick={() => setRevealChoice((r) => !r)}>
                {revealChoice ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {revealChoice ? 'Ocultar estoque' : 'Verificar divergências'}
              </Button>
            </Can>
          )}
          {isOpen && (
            <Can permission="inventories.count">
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                <RotateCcw className="size-4" />
                Zerar contagem
              </Button>
            </Can>
          )}
          <Can permission="inventories.view">
            <Button
              variant="outline"
              onClick={() => void openPdf(() => inventoriesApi.countSheet(id, { reveal: revealed }))}
            >
              <Printer className="size-4" />
              Imprimir contagem
            </Button>
          </Can>
          {isOpen && (
            <Can permission="inventories.close">
              <Button variant="destructive" onClick={() => setCloseOpen(true)}>
                <Lock className="size-4" />
                Fechar inventário
              </Button>
            </Can>
          )}
        </div>
      </div>

      <Card className="p-0">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>
        ) : (
          <InventoryCountTable
            items={visible}
            revealed={revealed}
            editable={canCount && isOpen}
            rowStates={rowStates}
            onSave={save}
            onRowError={(itemId, error) => setRowState(itemId, { error })}
          />
        )}
      </Card>

      <CloseInventoryDialog
        inventoryId={id}
        open={closeOpen && isOpen && can('inventories.close')}
        onOpenChange={handleCloseOpenChange}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Zerar contagem"
        description="Deseja realmente zerar toda a contagem?"
        confirmLabel="Zerar contagem"
        loading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
      />
    </div>
  )
}

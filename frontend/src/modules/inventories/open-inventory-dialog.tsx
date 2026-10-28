import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { inventoriesApi } from '@/services/inventories-api'
import { productGroupsApi } from '@/services/product-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { todayIso } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'

type Scope = 'all' | 'chosen'

const NO_GROUP_MESSAGE = 'Você não informou nenhum grupo para realizar o inventário.'

export function OpenInventoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Remonta o conteúdo a cada abertura: estado inicial limpo, sem efeito de reset.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <OpenInventoryContent onOpenChange={onOpenChange} />}
    </Dialog>
  )
}

function OpenInventoryContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [openingDate, setOpeningDate] = useState(todayIso)
  const [scope, setScope] = useState<Scope>('all')
  const [selected, setSelected] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const groupsQuery = useQuery({
    queryKey: ['product-groups', companyId, 'inventory-open'],
    queryFn: () =>
      productGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: scope === 'chosen',
  })

  const activeGroups = useMemo(
    () => (groupsQuery.data?.data ?? []).filter((group) => group.isActive),
    [groupsQuery.data],
  )
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term
      ? activeGroups.filter((group) => group.description.toLowerCase().includes(term))
      : activeGroups
  }, [activeGroups, search])

  const openMutation = useMutation({
    mutationFn: () =>
      inventoriesApi.open({
        openingDate,
        productGroupIds: scope === 'chosen' ? selected : [],
      }),
    onSuccess: (inventory) => {
      toast.success(`Inventário aberto com ${inventory.itemCount} produtos.`)
      queryClient.invalidateQueries({ queryKey: ['inventories', companyId] })
      onOpenChange(false)
      navigate(`/inventories/${inventory.id}`)
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  function toggle(id: number, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((x) => x !== id)))
    setError(null)
  }

  function submit() {
    if (scope === 'chosen' && selected.length === 0) {
      setError(NO_GROUP_MESSAGE)
      return
    }
    setError(null)
    openMutation.mutate()
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo inventário</DialogTitle>
        <DialogDescription>
          O sistema registra o saldo atual de cada produto ativo que controla estoque.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-opening-date">Data de abertura</Label>
          <Input
            id="inventory-opening-date"
            type="date"
            className="w-44"
            max={todayIso()}
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Abrangência</Label>
          <RadioGroup
            value={scope}
            onValueChange={(value) => {
              setScope(value as Scope)
              setError(null)
            }}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="inventory-scope-all" />
              <Label htmlFor="inventory-scope-all" className="font-normal">
                Todos os grupos
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="chosen" id="inventory-scope-chosen" />
              <Label htmlFor="inventory-scope-chosen" className="font-normal">
                Grupos escolhidos
              </Label>
            </div>
          </RadioGroup>
        </div>

        {scope === 'chosen' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Buscar grupo"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {groupsQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : visibleGroups.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2 rounded px-2 py-1.5">
                    <Checkbox
                      id={`inventory-group-${group.id}`}
                      checked={selected.includes(group.id)}
                      onCheckedChange={(checked) => toggle(group.id, checked === true)}
                    />
                    <Label
                      htmlFor={`inventory-group-${group.id}`}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {group.description}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={openMutation.isPending || !openingDate}>
          {openMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Abrir inventário
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

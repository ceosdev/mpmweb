---
title: Colunas ordenáveis devem ordenar no backend
impact: HIGH
impactDescription: Ordenação correta em todas as páginas, sem armadilhas de ordenação só no cliente
tags: crud, sorting, listing, query
---

## Colunas ordenáveis devem ordenar no backend

**Impacto: HIGH (ordenação correta em todas as páginas, sem armadilhas de ordenação só no cliente)**

Sempre que uma coluna da listagem de CRUD fizer sentido como ordenação, seu
`<TableHead>` deve ser **clicável** e a ordenação deve acontecer **no
backend**, nunca no cliente. Ordenar apenas a página atual é enganoso — o
usuário espera que a ordenação valha para o conjunto inteiro de dados, e
não só para as 20 linhas que ele está vendo.

A query string enviada à API usa dois parâmetros:

- `sort` — o nome da coluna em `snake_case` (igual à coluna do banco).
- `order` — `asc` ou `desc`.

Clicar em um cabeçalho ordenável faz o ciclo `asc → desc → nenhum`. A
ordenação atual faz parte da `queryKey` para que o TanStack Query refaça
o fetch automaticamente.

## Errado

```tsx
// ❌ Ruim — ordena apenas a página atual, em memória
const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name))

return <Table>{sorted.map(...)}</Table>
```

## Correto

```tsx
// ✅ Bom — ordenação no backend, codificada na queryKey
type SortState = { column: string; order: 'asc' | 'desc' } | null
const [sort, setSort] = useState<SortState>(null)

function toggleSort(column: string) {
  setSort((curr) => {
    if (curr?.column !== column) return { column, order: 'asc' }
    if (curr.order === 'asc') return { column, order: 'desc' }
    return null // terceiro clique limpa a ordenação
  })
  setPage(1) // resetar paginação ao mudar a ordenação
}

const listQuery = useQuery({
  queryKey: ['users', companyId, page, debouncedSearch, sort],
  queryFn: () =>
    usersApi.list({
      page,
      perPage: 20,
      search: debouncedSearch || undefined,
      sort: sort?.column,
      order: sort?.order,
    }),
})

return (
  <Table>
    <TableHeader>
      <TableRow>
        <SortableHeader column="name" sort={sort} onSort={toggleSort}>
          Nome
        </SortableHeader>
        <SortableHeader column="email" sort={sort} onSort={toggleSort}>
          E-mail
        </SortableHeader>
        <TableHead>Perfil</TableHead> {/* não ordenável: coluna derivada */}
      </TableRow>
    </TableHeader>
    {/* … */}
  </Table>
)
```

```tsx
// Componente compartilhado — extraído em `src/components/data-table/sortable-header.tsx`
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

interface Props {
  column: string
  sort: { column: string; order: 'asc' | 'desc' } | null
  onSort: (column: string) => void
  children: React.ReactNode
}

export function SortableHeader({ column, sort, onSort, children }: Props) {
  const active = sort?.column === column
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="flex items-center gap-1 font-medium hover:text-foreground"
      >
        {children}
        <Icon className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  )
}
```

## Regras práticas

- **Marque uma coluna como ordenável** somente quando o backend suportar
  ordenação por ela (coluna real do banco ou coluna derivada explicitamente
  permitida em whitelist).
- **Mudanças de ordenação devem resetar `page` para 1** — caso contrário o
  usuário cai em um pedaço arbitrário da lista recém-ordenada.
- **Ordenação por uma única coluna** salvo necessidade explícita. Múltiplas
  colunas adicionam complexidade sem motivo forte para este app.
- Colunas não ordenáveis (ex.: badges de permissão, botões de ação)
  continuam usando `<TableHead>` puro — não simule um handler vazio.
- Convenção de ícones: parado = `ArrowUpDown`, asc = `ArrowUp`, desc = `ArrowDown`
  (lucide-react).

## Relacionadas

- [[crud-pagination]] — ordenação e página fazem parte do mesmo estado da query.
- [[ui-component-reuse]] — `SortableHeader` mora em `components/data-table/`,
  nunca duplicado por módulo.

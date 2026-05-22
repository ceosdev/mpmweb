---
title: Pagine toda listagem de CRUD em 20 registros por página
impact: CRITICAL
impactDescription: Performance previsível e UX consistente entre módulos
tags: crud, pagination, listing, query
---

## Pagine toda listagem de CRUD em 20 registros por página

**Impacto: CRITICAL (performance previsível e UX consistente entre módulos)**

Toda listagem de CRUD deve ser paginada no servidor em **20 registros por
página**. Nunca chame um endpoint de `list` sem o parâmetro `page` e nunca
renderize uma coleção inteira de uma vez — mesmo que o conjunto atual de
dados seja pequeno. Isso mantém a UX uniforme entre os módulos e garante que
a tela não vai degradar à medida que os dados crescerem.

O backend já devolve resultados paginados com um envelope `meta`
(`page`, `lastPage`, `total`, `perPage`). O frontend espelha esse contrato.

## Errado

```tsx
// ❌ Ruim — carrega a coleção inteira, sem parâmetro `page`
const listQuery = useQuery({
  queryKey: ['users', companyId],
  queryFn: () => usersApi.list(),
})

return (
  <Table>
    {listQuery.data?.data.map((u) => <TableRow key={u.id}>…</TableRow>)}
  </Table>
)
```

## Correto

```tsx
// ✅ Bom — paginado, 20 por página, queryKey com escopo da empresa
const [page, setPage] = useState(1)

const listQuery = useQuery({
  queryKey: ['users', companyId, page, debouncedSearch, sort],
  queryFn: () =>
    usersApi.list({
      page,
      perPage: 20,
      search: debouncedSearch || undefined,
      sort,
    }),
  placeholderData: (prev) => prev, // mantém a página anterior visível enquanto carrega
})

const meta = listQuery.data?.meta

return (
  <>
    <Table>{/* linhas */}</Table>

    {meta && meta.lastPage > 1 && (
      <Pagination
        page={meta.page}
        lastPage={meta.lastPage}
        total={meta.total}
        onChange={setPage}
      />
    )}
  </>
)
```

## Regras práticas

- **Tamanho da página é 20** a menos que exista um motivo documentado para
  fugir disso. Não exponha um seletor de "registros por página" para o
  usuário por padrão.
- **Resete `page` para 1** sempre que o termo de busca, um filtro ou a
  direção de ordenação mudar.
- **Sempre inclua o id da empresa ativa** na `queryKey` para que trocar de
  empresa invalide o cache (ver `CLAUDE.md` — multiempresa).
- Use `placeholderData: (prev) => prev` (TanStack Query v5) para que a
  página anterior continue visível enquanto a próxima carrega — evita o
  flash de tela vazia.
- Renderize o rodapé de paginação só quando `meta.lastPage > 1`.

## Relacionadas

- [[crud-sortable-columns]] — mudanças de ordenação também devem resetar `page` para 1.
- Ver `src/modules/users/users-page.tsx` para a referência canônica.

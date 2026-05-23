# Spec: Criar tela de subgrupo de produto

> ⚠️ **Não é simple-CRUD puro.** Subgrupo tem relacionamento com pai (`product_groups`)
> e navegação por drill-down — a [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> diz para abandonar quando há relacionamento. Esta spec adota o **mesmo formato visual**
> (descrição + status, busca, paginação, ordenação, modal, hard delete) **escopado por um
> grupo de produto pai**.

## Domínio

- **Entidade**: subgrupo de produto (`product_subgroup`).
- **Pai**: grupo de produto (`product_group`).
- **Exemplos**: Para o grupo *"Ar condicionado"* → "Janela", "Split", "Cassete", "Portátil".
  Para o grupo *"Ferramentas"* → "Manuais", "Elétricas", "Pneumáticas".
- **Justificativa**: refinar a categorização dos produtos dentro de cada grupo, sem
  poluir o cadastro de grupos com itens muito específicos.

## Modelo de navegação

O subgrupo **não tem item no menu principal**. O acesso é por drill-down a partir da
listagem de grupos de produto:

```
/product-groups
   └── (clique no ícone Layers da linha "Ar condicionado")
       └── /product-groups/{id}/subgroups   ← tela desta spec
```

A tela de subgrupos sempre opera no contexto de **um** grupo. Mover um subgrupo de um
grupo para outro **não é suportado** nesta versão (basta excluir e recriar).

## Específicos do módulo

- **Tabela**: `product_subgroups`
- **Slug do módulo**: `product_subgroups` (permissões separadas das de grupo)
- **Endpoints (nested)**:
  - `GET    /api/product-groups/:groupId/subgroups`
  - `POST   /api/product-groups/:groupId/subgroups`
  - `GET    /api/product-groups/:groupId/subgroups/:id`
  - `PUT    /api/product-groups/:groupId/subgroups/:id`
  - `DELETE /api/product-groups/:groupId/subgroups/:id`
- **Rota frontend**: `/product-groups/:groupId/subgroups`
- **Módulo frontend**: `src/modules/product-subgroups/`
- **Ícone (no botão de drill-down do parent)**: `Layers`
- **No menu**: NÃO entra no menu lateral.

## Schema do banco

```ts
table.increments('id').notNullable()

table
  .integer('company_id')
  .unsigned()
  .notNullable()
  .references('id').inTable('companies').onDelete('RESTRICT')

table
  .integer('product_group_id')
  .unsigned()
  .notNullable()
  .references('id').inTable('product_groups').onDelete('RESTRICT')

table.string('description', 120).notNullable()
table.boolean('is_active').notNullable().defaultTo(true)

table.timestamp('created_at').notNullable()
table.timestamp('updated_at').notNullable()

table.index(['product_group_id', 'description'], 'product_subgroups_group_description_idx')
```

- `company_id` é **denormalizado** (já está em `product_group_id → company_id`) para
  defender contra acesso cruzado entre tenants em caso de bug e simplificar queries.
- Hard delete (sem `deleted_at`), como nos outros simple-CRUDs.
- Sem unicidade — pode haver dois subgrupos com mesma descrição dentro do mesmo grupo
  (consistente com o padrão da família).

## Permissões

4 slugs novos, separados de `product_groups.*`:

- `product_subgroups.view`
- `product_subgroups.create`
- `product_subgroups.edit`
- `product_subgroups.delete`

Adicionar em `backend/app/abilities/catalog.ts` na seção depois de `product_groups`.

## Backend

Pipeline padrão (Migration → Model → Repository → Service → Validator → Controller → Rota).
Diferenças em relação ao simple-CRUD canônico:

- **Repository** filtra por `company_id` **e** por `product_group_id`.
- **Service** valida que o `product_group_id` recebido existe e pertence ao tenant antes
  de listar/criar; se o grupo não existe ou é de outra empresa, lança `NotFoundException`
  com a mensagem *"Grupo de produto não encontrado."* (404, não 403 — não vaza existência).
- **Controller** lê `params.groupId` da URL e passa adiante. Os payloads de create/update
  **não** aceitam `productGroupId` no body — o pai vem só do path.
- **Rotas** ficam dentro do mesmo grupo `middleware.auth() + middleware.tenant()` já
  existente, com `middleware.permission('product_subgroups.<action>')` em cada uma.

### Erro de FK na exclusão

Igual ao padrão: se a exclusão falhar com `23503` (subgrupo referenciado por algum
futuro `products`), o serviço lança `ConflictException` (409) com mensagem
*"Não é possível excluir este subgrupo de produto porque está em uso."*.

## Frontend

### Modificações no `/product-groups`

- Adicionar **ícone `Layers`** no final da célula de ações, **antes** do `Pencil`
  (ordem das ações: `Layers` → `Pencil` → `Trash2`).
- O botão é envolto em `<Can permission="product_subgroups.view">` para esconder de
  quem não pode ver.
- `aria-label="Ver subgrupos"`, `title="Ver subgrupos"`.
- Onclick navega via `useNavigate` para `/product-groups/{row.id}/subgroups`.

### Nova rota `/product-groups/:groupId/subgroups`

- Registrar em `routes/router.tsx` com `lazy()` e `PermissionRoute permission="product_subgroups.view"`.
- Componente: `ProductSubgroupsPage` em `src/modules/product-subgroups/product-subgroups-page.tsx`.

### Layout da tela de subgrupos

Igual à simple-CRUD canônica, **exceto** o header:

- À esquerda do título, um `Button variant="ghost" size="icon"` com ícone `ArrowLeft`
  que volta para `/product-groups` via `useNavigate(-1)` ou `Link to="/product-groups"`.
- **Título**: `"Subgrupos de {parentGroup.description}"`.
  - O nome do grupo é obtido por uma `useQuery` separada que chama
    `productGroupsApi.get(groupId)` (já existe). Enquanto carrega, mostrar
    `"Subgrupos"` simples ou skeleton.
  - Se a query do grupo retornar 404, a página exibe um `EmptyState` com título
    *"Grupo de produto não encontrado"* e botão *"Voltar para grupos"* — sem listar
    subgrupos.
- **Descrição** do header: *"Subgrupos vinculados a este grupo de produto."*
- **Botão "Novo subgrupo de produto"** à direita, gated por `product_subgroups.create`.

Tudo o mais (busca debounced, paginação 20/página, ordenação por descrição/status,
modal com 2 campos, empty state contextual, badges Ativo/Inativo, confirmação de
exclusão, toasts) é **idêntico** ao padrão da rule simple-crud-pattern — com o `groupId`
inserido em todos os caminhos de API e em todas as `queryKey` (para o cache invalidar
corretamente ao trocar de grupo pai).

`queryKey` da listagem: `['product-subgroups', companyId, groupId, debouncedSearch, page, sort]`.

### Modal de form

Igual ao canônico, com 2 campos (descrição + ativo). Não pede `productGroupId` ao
usuário — é injetado pelo path da rota.

## Critérios de aceite

- Padrão da rule simple-crud-pattern para descrição + status + busca + paginação +
  ordenação + modal + hard delete + empty state contextual.
- **Adicional**:
  1. A tela só é alcançável a partir do drill-down no `/product-groups` — não há link no
     menu lateral.
  2. O header da tela mostra o nome do grupo pai e tem botão de voltar.
  3. As queries no backend filtram por `company_id` **e** `product_group_id`.
  4. Tentar acessar `/product-groups/999/subgroups` (grupo inexistente ou de outra
     empresa) mostra o empty state "Grupo de produto não encontrado" — não vaza dados.
  5. Não é possível mover um subgrupo entre grupos (a edição não troca o pai).
  6. Excluir um grupo de produto com subgrupos vinculados → backend responde 409 por FK
     RESTRICT, com a mensagem amigável existente.

## Não-objetivos (fora desta spec)

- Edição em lote, importação, exportação.
- Mover subgrupos entre grupos.
- Histórico/auditoria de quem criou ou alterou.
- Filtro por status (ativos/inativos).
- Ordenação configurável de subgrupos (drag-and-drop).
- Subgrupos de subgrupos (sem hierarquia recursiva).

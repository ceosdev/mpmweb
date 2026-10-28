# Inventário de Produtos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar **Mercadoria → Inventário de produtos**. O usuário abre um inventário, que grava uma foto do saldo dos produtos ativos que controlam estoque, de todos os grupos ou dos escolhidos. Em seguida lança a contagem cega na tela de contagem, verifica as divergências, zera e imprime a contagem em PDF. Ao fechar, o saldo de cada produto passa a ser o contado (não contado = 0). Além disso, o cancelamento de uma entrada de mercadoria já inventariada passa a ser bloqueado.

**Architecture:**
- Três tabelas novas: `inventories`, `inventory_product_groups` e `inventory_items`.
- Um service com abrir, listar, consultar, excluir, lançar contagem, zerar, preview e fechar. O fechamento roda numa transação que trava os produtos com o `lockProducts` já existente e grava o saldo **absoluto**.
- O PDF reaproveita `app/services/pdf/`.
- O frontend tem a listagem com um modal de abertura e uma rota de contagem com input por linha (Enter grava e desce).
- A Entrada de mercadoria ganha um 4º bloqueio no `assertReversible`.

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL + pdfmake (já instalado); React 19 + Vite + TanStack Query + shadcn/ui + Tailwind v4.

**Spec:** [`docs/spec/movimentacao/005-criar-tela-inventario-de-produtos.md`](../../spec/movimentacao/005-criar-tela-inventario-de-produtos.md). As decisões A–I estão em [`004-analise-inventario-de-produtos.md`](../../spec/movimentacao/004-analise-inventario-de-produtos.md). Leia a spec antes de começar: as **mensagens exatas** estão lá. Onde o plano e a spec divergirem, **a spec manda**. Para a implementação, use como referência a Saída de mercadoria (`backend/app/services/goods_exit_service.ts`, `goods_exit_stock.ts`, `app/services/pdf/goods_exit_protocol.ts`, `frontend/src/modules/goods-exits/`) e espelhe a estrutura, os nomes e o idioma.

## Global Constraints

- **Idioma**: código em inglês; UI e mensagens da API em português.
- **Multitenant**: toda query filtra `tenant.company.id`, e toda `queryKey` inclui `companyId`.
- **Camadas**: controller fino → service → repository → model.
- **Escrita multi-tabela em `db.transaction`**, com `forUpdate()` no inventário. Os produtos são travados por `lockProducts` (`goods_exit_stock.ts`), em **ordem crescente de id**.
- **Decimais**: quantidade `decimal(15,4)`, como string na API (regex `^\d{1,11}(\.\d{1,4})?$`). Comparações e diferenças são feitas em `BigInt` via `#utils/decimal` (`toScaled`, `fromScaled`, `QTY_SCALE`). **Nunca use `Number()`** em quantidade.
- **"Hoje"** = `todayIso()`.
- **Permissão nova = 2 arquivos**: `catalog.ts` e `module-labels.ts` (`inventories: 'Inventários de produtos'`).
- **Impressão = PDF em nova aba** via `openPdf` (`frontend/src/lib/open-pdf.ts`).
- **Cores só por token**. O `PageHeader` usa o ícone do menu, `ClipboardList`.
- **Sem testes automatizados** (decisão do usuário, mantida dos módulos anteriores). Cada tarefa fecha com **typecheck + script de verificação executado + commit**.
- **Seed**: `node ace db:seed --files database/seeders/main_seeder.ts`.
- **Git**: branch `feat/inventories`. `git add` só dos arquivos da tarefa, nunca `-A`.

### Harness de verificação

Reaproveite `api.mjs` (`login`, `loginAs(i)`, `api`, `check`) de `/tmp/claude-1000/-home-csantana-projects-cartech-mpmweb/b64d91e5-194e-4c0f-a8eb-fa236439200c/scratchpad/verify/`, copiando para `<scratchpad>/verify/` da sessão atual. Se não existir, recrie pela seção *Harness de verificação* de [`2026-10-27-funcionarios.md`](./2026-10-27-funcionarios.md).

- **PDF**: `pdfjs-dist@4.10.38` instalado no scratchpad, como no plano da saída.
- **UI**: Playwright headless, como no plano da saída (`playwright-core` e Chromium nos caminhos citados lá).
- **Dados**: cada script cria os próprios grupos e produtos com sufixo aleatório.
  - O inventário é **um aberto por empresa**, então todo script começa excluindo o inventário aberto da empresa de teste, se houver.
  - Use um grupo próprio, para que "Todos os grupos" não arraste produtos de outros scripts para as asserções.
  - Asserções sobre itens sempre filtram pelos produtos criados no script.
- **Saldo inicial**: por Entrada de mercadoria finalizada. Para os casos legados, use `psql` (`quantity_in_stock = null`).

## Review Focus

1. **Contagem gravada durante o fechamento.** Um `PUT` de item que chega depois de o `close` ter começado espera a trava do inventário e responde 422 *"Operação não permitida: o inventário não está aberto."*. Nunca deve gravar sobre um inventário fechado. Teste na Task 3.
2. **Produto mudou entre a abertura e o fechamento.**
   - Se ficou inativo, é ajustado normalmente.
   - Se deixou de controlar estoque, não é ajustado (`stock_at_close` null, saldo continua `null`) e aparece em "Não ajustados" no preview.
   - Se o saldo legado é `null`, a foto é 0.

   Teste na Task 4.
3. **Entrada finalizada com o inventário aberto e cancelada depois do fechamento.** É bloqueada, porque a regra compara com `closed_at` e não com a abertura. Uma entrada finalizada depois do fechamento cancela normalmente. Teste na Task 5.
4. **Digitação pt-BR na contagem.**
   - `5,2` vira `"5.2"`, `1.234,5` vira `"1234.5"`, e vazio vira `null` (não contado).
   - `-1`, `1,23456` e texto não chamam a API.
   - Enter numa linha enquanto a anterior ainda grava não perde nenhuma das duas.

   Teste na Task 8.
5. **Duas aberturas simultâneas na mesma empresa.** Uma vence e a outra recebe 422 *"Já existe um inventário em aberto."*: a violação do índice parcial é traduzida e não vira 500. Outra empresa abre normalmente. Teste na Task 2.

---

## Estrutura de arquivos

**Backend — criar**
- `database/migrations/<ts>_create_inventories_table.ts`, `<ts>_create_inventory_product_groups_table.ts`, `<ts>_create_inventory_items_table.ts`
- `app/models/inventory.ts`, `app/models/inventory_product_group.ts`, `app/models/inventory_item.ts`
- `app/repositories/inventory_repository.ts`
- `app/validators/inventory_validators.ts`
- `app/services/inventory_service.ts` — open, list, show, destroy, updateItem, resetCount, closePreview, close e serialize
- `app/services/pdf/inventory_count_sheet.ts`
- `app/controllers/inventories_controller.ts`

**Backend — modificar**: `app/abilities/catalog.ts`, `start/routes.ts`, `app/services/goods_entry_stock.ts` (4º bloqueio).

**Frontend — criar**: `src/services/inventories-api.ts` e, em `src/modules/inventories/`, os arquivos `inventories-page.tsx`, `open-inventory-dialog.tsx`, `inventory-count-page.tsx`, `inventory-count-table.tsx`, `close-inventory-dialog.tsx` e `inventory-status-badge.tsx`.

**Frontend — modificar**: `src/types/api.ts`, `src/permissions/module-labels.ts`, `src/permissions/menu.ts`, `src/routes/router.tsx`, `src/lib/open-pdf.ts` (texto do toast de pop-up genérico: *"Permita pop-ups para este site para abrir o PDF."*).

**Docs**: `state.md`.

---

### Task 1: Tabelas, models e permissões

**Files:** criar as 3 migrations e os 3 models; modificar `catalog.ts` e `module-labels.ts`.

**Interfaces — Produces:**
- Tabelas exatamente como a seção *Campos* da spec, com:
  - o índice parcial `inventories_company_open_uq` (`this.schema.raw`: `create unique index ... on inventories (company_id) where status = 'open'`);
  - `inventory_product_groups_inventory_group_uq`;
  - `inventory_items_inventory_product_uq`;
  - o índice `inventory_items (product_id)` da decisão H.
- `Inventory`:
  - `openingDate: DateTime`, `openedByUserId`, `status: InventoryStatus`, `closedAt: DateTime | null`, `closedByUserId: number | null`;
  - `hasMany items`, `hasMany groups`, `belongsTo openedBy/closedBy` (`User`);
  - `InventoryStatus = 'open' | 'closed'`.
- `InventoryProductGroup`: `inventoryId`, `productGroupId`, `belongsTo productGroup`.
- `InventoryItem`: `stockQuantity: string`, `countedQuantity: string | null`, `stockAtClose: string | null` (decimais como string, como em `GoodsExitItem`), `belongsTo product`.
- Catálogo: as 5 permissões da tabela da spec (slug, `name` e `description` exatos), com `module: 'inventories'`, logo após `goods_exits.*`. Label `inventories: 'Inventários de produtos'`.

- [ ] **Step 1:** Criar as migrations e os models.
- [ ] **Step 2:** Adicionar catálogo e label. Rodar `node ace migration:run`, `node ace migration:rollback` (desfaz só o último batch) e `node ace migration:run` de novo; todos ok. Rodar o seed só do `main_seeder`.
- [ ] **Step 3:** Conferir no `psql`:
  - os uniques e o índice parcial existem;
  - um segundo `insert` manual de inventário `open` na mesma empresa falha com `23505`;
  - um `closed` passa.
- [ ] **Step 4:** `npm run typecheck` limpo. Commit `feat(inventories): tabelas, models e permissões`.

### Task 2: Abrir, listar, consultar e excluir (backend)

**Files:** criar `inventory_repository.ts`, `inventory_validators.ts`, `inventory_service.ts` (esta parte) e `inventories_controller.ts`; modificar `start/routes.ts`.

**Interfaces — Consumes:** models (Task 1).

**Interfaces — Produces:**
- `openValidator`: `{ openingDate: string (ISO date, ≤ todayIso()), productGroupIds: number[] (únicos, pode ser vazio) }`.
- `inventoryService.open(tenant, user, payload)` devolve `serialize(row)`. Roda a transação da spec (*Abrir inventário*): checagem do aberto, cabeçalho, grupos e um único `INSERT … SELECT` dos itens. Zero itens dá 422 e rollback. O `23505` em `inventories_company_open_uq` é traduzido para a mesma 422 do aberto.
- `inventoryService.list(tenant, filters)` devolve `{ data, meta }`, com `meta.hasOpen: boolean` somado ao meta da paginação.
  - Filtros: `openingFrom` e `openingTo` (datas, opcionais) e `status` (`open` | `closed` | ausente).
  - `SORT_EXPRESSIONS`: `id`, `opening_date`, `closed_at` e `status` (`CASE` open → closed).
  - Default de ordenação: `opening_date desc, id desc`.
- `serialize(row)`, o cabeçalho:
  - `{ id, openingDate, status, closedAt, openedByName, closedByName }`;
  - `groups: { id, description }[]`, com `[]` significando todos;
  - `itemCount` e `countedCount`, por subquery correlacionada no list e por contagem no show.
- `inventoryService.show(tenant, id, { reveal: boolean })` devolve `serialize(row)` mais `items`, ordenados por `products.description`:
  - cada item: `{ id, productId, productDescription, unitOfMeasure: string | null, productType, countedQuantity: string | null, state }`;
  - com `reveal`, ou com o inventário fechado: também `stockQuantity`, `difference: string | null` e `stockAtClose`, e `state` passa a ser `'uncounted' | 'match' | 'divergent'`;
  - sem `reveal`: `state: 'uncounted' | 'counted'`, sem as chaves `stockQuantity`, `difference` e `stockAtClose` (**ausentes**, não `null`);
  - `hasTools: boolean` no cabeçalho do show (algum item `productType === 'tool'`).
- `inventoryService.destroy(tenant, id)`: só `open`, senão 422 *"Inventário já finalizado."*. Apaga itens, grupos e cabeçalho na transação.
- Rotas:
  - `GET /inventories` (`view`), `POST /inventories` (`create`);
  - `GET /inventories/:id` (`view`, query `reveal=1`);
  - `DELETE /inventories/:id` (`delete`).

- [ ] **Step 1:** Escrever repository, validators, service (esta parte), controller e rotas.
- [ ] **Step 2:** Script `inventories-open.mjs`:
  - **Todos os grupos**: grupo próprio com 3 produtos:
    - A: ativo, controla estoque, saldo 5,2 por entrada;
    - B: ativo, sem controle;
    - C: inativo, controla.

    Abrir com todos dá 201. Itens do script: só A, com `stockQuantity` ausente (cego) e `countedQuantity: null`. Com `?reveal=1`, `stockQuantity '5.2000'`.
  - **Um aberto por empresa**:
    - abrir de novo → 422 com a mensagem da spec;
    - **RF 5**: duas `POST` em `Promise.all` depois de excluir → uma 201 e uma 422;
    - `loginAs(1)` abre na outra empresa → 201.
  - **Grupos escolhidos**: excluir e abrir com só um grupo que não tem produto elegível → 422 *"Nenhum produto ativo…"*, e nada foi criado (a listagem não ganhou linha).
  - **Validações**: grupo inativo → 422; grupo de outra empresa → 422; data futura → 422.
  - **Legado**: produto com `quantity_in_stock = null` (via `psql`) entra com foto `'0.0000'`.
  - **Listagem**: `meta.hasOpen` true ou false conforme o caso; filtro `status`; ordenação por `id`, `opening_date`, `closed_at` e `status`, asc e desc.
  - **Excluir**: excluir aberto → 204, e os itens somem (`psql`).
  - **FK**: com um inventário que usa o produto A e o grupo do script, excluir o produto → 409 e excluir o grupo → 409.
- [ ] **Step 3:** typecheck limpo. Commit `feat(inventories): abrir, listar e excluir inventário`.

### Task 3: Lançar e zerar contagem (backend)

**Files:** modificar `inventory_validators.ts`, `inventory_service.ts`, `inventories_controller.ts` e `start/routes.ts`.

**Interfaces — Produces:**
- `updateItemValidator`: `{ countedQuantity: string | null }` (regex de 4 casas, ≥ 0).
- `inventoryService.updateItem(tenant, inventoryId, itemId, countedQuantity)`:
  - devolve o item serializado **cego** (`state` `counted`/`uncounted`);
  - roda numa transação com `forUpdate()` no inventário: status ≠ `open` dá 422 da spec;
  - item de outro inventário ou de outra empresa → 404 *"Item do inventário não encontrado."*.
- `inventoryService.resetCount(tenant, id)`: `update inventory_items set counted_quantity = null where inventory_id = ?`, com a mesma trava e a mesma regra de status. Devolve `204`.
- Rotas: `PUT /inventories/:id/items/:itemId` e `POST /inventories/:id/reset-count`, ambas `count`.

- [ ] **Step 1:** Implementar as duas ações e as rotas.
- [ ] **Step 2:** Script `inventories-count.mjs`:
  - **Lançar**: `'4.8'` grava `'4.8000'`; `'0'` → `'0.0000'` e `state 'counted'`; `null` → não contado.
  - **Recusas**: `'-1'`, `'1.23456'` e `'abc'` → 422.
  - **Escopo**: `itemId` de outro inventário → 404.
  - **Zerar**: zerar deixa todos `null`.
  - **Gates de permissão**: sem `inventories.count` → 403 (perfil de teste com só `view`, criado no script).
  - **Status**: depois de fechar (Task 4: rode este trecho no fim do script da Task 4 se a 4 ainda não existir), PUT e reset → 422.
  - **RF 1**: dispare `close` e, sem esperar, um `PUT` de item. Se o PUT terminar depois do close, a resposta é 422 e o banco mantém o valor de antes do close. Repita 5 vezes.
- [ ] **Step 3:** typecheck limpo. Commit `feat(inventories): lançar e zerar contagem`.

### Task 4: Preview e fechamento (backend)

**Files:** modificar `inventory_service.ts`, `inventories_controller.ts` e `start/routes.ts`.

**Interfaces — Consumes:** `lockProducts(trx, companyId, productIds): Promise<Map<number, Product>>` (`goods_exit_stock.ts`).

**Interfaces — Produces:**
- `inventoryService.closePreview(tenant, id)` devolve:
  ```ts
  {
    itemCount: number; countedCount: number; uncountedCount: number;
    changingCount: number;               // coalesce(contado,0) ≠ foto, só itens ajustáveis
    moved: { productId; productDescription; stockQuantity: string; currentStock: string; countedQuantity: string | null }[];
    notAdjusted: { productId; productDescription }[];       // controls_stock = false agora
    toolsOnLoan: { goodsExitId; employeeName; productId; productDescription; quantity: string }[];
  }
  ```
  - `moved`: itens ajustáveis cujo `coalesce(quantity_in_stock, 0)` atual difere da foto.
  - `toolsOnLoan`: itens de `goods_exits` com `exit_type = 'tool'` e `status = 'delivered'`, da empresa, com `product_id` entre os itens do inventário. A quantidade é `requested_quantity`.
  - Inventário fechado → 422 da spec.
- `inventoryService.close(tenant, user, id)` devolve `serialize(row)`. Segue a transação da spec (*Fechar inventário*, passos 1–5): grava o valor absoluto, `stock_at_close` só nos ajustados e não toca no `cost_price`.
- Rotas: `GET /inventories/:id/close-preview` e `POST /inventories/:id/close`, ambas `close`.

- [ ] **Step 1:** Implementar o preview, o close e as rotas.
- [ ] **Step 2:** Script `inventories-close.mjs`, com produtos próprios:
  - **Preparação**:
    - P1 foto 10, contado 8;
    - P2 foto 3, não contado;
    - P3 foto 4, contado 4;
    - P4 foto 6, contado 6, que depois da abertura recebe uma entrada de +2 (saldo 8);
    - P5 ferramenta com saldo 2 e uma saída de ferramentas entregue de 1.
  - **Preview**:
    - `uncountedCount` inclui P2;
    - `changingCount` conta P1 e P2 (P4 tem contado = foto, então não conta);
    - `moved` traz P4 com `currentStock '8.0000'`;
    - `toolsOnLoan` traz P5 com o funcionário e quantidade `'1.0000'`.
  - **Close**:
    - saldos P1 8, P2 0, P3 4 e P4 6 (o absoluto sobrescreve a entrada);
    - `stock_at_close` P4 = `'8.0000'`;
    - `cost_price` inalterado;
    - status `closed`, `closedAt` e `closedByName` preenchidos;
    - fechar de novo → 422;
    - excluir → 422 *"Inventário já finalizado."*.
  - **RF 2**, num inventário novo:
    - produto que deixou de controlar estoque depois da abertura (via `PUT /products`) aparece em `notAdjusted`, saldo continua `null` e `stock_at_close` null;
    - produto que ficou inativo é ajustado.
  - **Ferramenta devolvida depois do fechamento**: devolver a saída de P5 deixa o saldo = contado + 1.
  - **Show do fechado**: sem `reveal`, devolve `stockQuantity` e `difference` mesmo assim.
- [ ] **Step 3:** typecheck limpo. Commit `feat(inventories): preview e fechamento do inventário`.

### Task 5: Bloqueio do cancelamento de entrada já inventariada

**Files:** modificar `backend/app/services/goods_entry_stock.ts` (`assertReversible`).

**Interfaces — Produces:**
- `assertReversible` ganha uma verificação sobre os itens com `stockEffect === 'stock'`.
- A verificação é uma query única que devolve o primeiro `product_id` encontrado (na ordem dos itens):
  ```sql
  select ii.product_id from inventory_items ii
  join inventories i on i.id = ii.inventory_id
  where i.company_id = ? and i.status = 'closed' and i.closed_at > ?
    and ii.stock_at_close is not null and ii.product_id = any(?)
  ```
  O segundo parâmetro é o `entry.finalizedAt`.
- Mensagem: a da spec (*"Não é possível cancelar: o produto {produto} passou por inventário depois desta entrada, e o estoque não pode ser estornado."*).
- Roda depois da trava dos produtos e antes dos outros bloqueios de estoque. Entrada `open` não passa por `assertReversible`: confira em `goods_entry_service.ts:407` e não mude isso.

- [ ] **Step 1:** Implementar o bloqueio.
- [ ] **Step 2:** Script `inventories-entry-cancel.mjs`:
  - Entrada E1 finalizada, inventário aberto e fechado com o produto → cancelar E1 dá 422 com o nome do produto, e títulos, saldo e status ficam intactos.
  - Entrada E2 finalizada depois do fechamento → cancela normalmente.
  - **RF 3**: inventário aberto, E3 finalizada com ele aberto, inventário fechado → cancelar E3 dá 422.
  - Produto que estava num inventário mas **não foi ajustado** (deixou de controlar estoque; `stock_at_close` null) e foi religado depois não bloqueia por essa regra.
  - Entrada só com item de ativo imobilizado → não é afetada.
  - Inventário de outra empresa não bloqueia.
- [ ] **Step 3:** typecheck limpo. Commit `feat(goods-entries): bloqueia cancelar entrada já inventariada`.

### Task 6: PDF da contagem (backend)

**Files:** criar `app/services/pdf/inventory_count_sheet.ts`; modificar `inventories_controller.ts` e `start/routes.ts`.

**Interfaces — Consumes:** `renderPdf`, `companyHeader(company)`, `formatQuantityPtBr`, `formatDatePtBr` e `nowPtBr` (`pdf_service.ts`); `inventoryService.show`.

**Interfaces — Produces:**
- `buildInventoryCountSheet(inventory: ReturnType<serialize> & { items }, company: Company, reveal: boolean): Promise<TDocumentDefinitions>`.
  - O conteúdo segue a seção *Imprimir contagem (PDF)* da spec:
    - sem `reveal`, as colunas são Código, Descrição, Un. e Qtd. contada, com linha em branco no não contado;
    - com `reveal`, há também Qtd. estoque e Diferença, e as linhas divergentes têm `fillColor` vermelho claro;
    - totais no rodapé;
    - observação de ferramentas quando `hasTools`.
  - Molde: `goods_exit_protocol.ts`.
- `GET /inventories/:id/count-sheet` (`view`, query `reveal=1`; fechado força `reveal`). Responde com `content-type: application/pdf` e `content-disposition: inline; filename="inventario-<id>.pdf"`.

- [ ] **Step 1:** Implementar o builder, a action e a rota.
- [ ] **Step 2:** Script `inventory-sheet.mjs` (`pdfjs-dist`):
  - **Cego**: os bytes começam com `%PDF-`; o texto contém *"Relatório de Contagem de Inventário"*, o nº com 10 dígitos, a razão social e o produto; **não contém** "Qtd. estoque".
  - **Revelado**: com `reveal=1`, contém "Qtd. estoque" e "Diferença", e o contado `4,8` aparece formatado.
  - **Fechado**: inventário fechado sem `reveal` contém "Qtd. estoque".
  - **Ferramentas**: com ferramenta, contém o texto do aviso.
  - **Multitenant**: inventário de outra empresa → 404.
- [ ] **Step 3:** typecheck limpo. Commit `feat(inventories): PDF da contagem`.

### Task 7: Listagem, abertura, menu e rotas (frontend)

**Files:** criar `inventories-api.ts`, `inventories-page.tsx`, `open-inventory-dialog.tsx` e `inventory-status-badge.tsx`; modificar `types/api.ts`, `menu.ts`, `router.tsx` e `open-pdf.ts`.

**Interfaces — Produces:**
- `inventoriesApi`:
  - `list(params)`, `get(id, { reveal })`, `open(payload)`, `remove(id)`;
  - `updateItem(id, itemId, countedQuantity: string | null)`, `resetCount(id)`;
  - `closePreview(id)`, `close(id)`;
  - `countSheet(id, { reveal }): Promise<Blob>`.
- Tipos em `types/api.ts`:
  - `Inventory`, `InventoryItem` (com `stockQuantity?`, `difference?` e `stockAtClose?` opcionais);
  - `InventoryItemState`, `InventoryStatus`, `InventoryClosePreview`, `InventoryOpenPayload`.
- Query keys:
  - `['inventories', companyId, 'list', filters]`;
  - `['inventories', companyId, id, { reveal }]`.

- [ ] **Step 1:** Montar a listagem espelhando `goods-exits-page.tsx`:
  - filtros, colunas e ordenação da spec;
  - "Novo inventário" desabilitado com tooltip quando `meta.hasOpen`;
  - menu Ações pela tabela da spec;
  - Excluir com o `ConfirmDialog` da spec;
  - "Imprimir contagem" com `openPdf(() => inventoriesApi.countSheet(id, { reveal: false }))`;
  - "Fechar inventário" navega para `/inventories/:id?close=1`, e a Task 9 abre o diálogo a partir desse parâmetro.
- [ ] **Step 2:** Montar o modal de abertura conforme a spec:
  - `DatePicker` não futuro;
  - `RadioGroup` Todos / Grupos escolhidos;
  - checkboxes dos grupos ativos de `productGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' })` filtrados por `isActive`, com busca;
  - mensagem local de nenhum grupo;
  - sucesso com o toast *"Inventário aberto com N produtos."* (`itemCount`) e `navigate('/inventories/:id')`.
- [ ] **Step 3:** Menu "Inventário de produtos" (`ClipboardList`, `inventories.view`) depois de "Saída de mercadoria". Rotas `/inventories` e `/inventories/:id` em `PermissionRoute` `inventories.view`; a página de contagem é um placeholder até a Task 8. Trocar o texto do toast em `open-pdf.ts`.
- [ ] **Step 4:** `npx tsc -p tsconfig.app.json --noEmit` limpo. Playwright:
  - a listagem abre com o filtro de data do mês;
  - abrir pelo modal com grupos escolhidos navega para `/inventories/:id`;
  - de volta à listagem, o botão "Novo inventário" está desabilitado;
  - "Imprimir contagem" abre uma página `blob:`;
  - Excluir remove a linha.
- [ ] **Step 5:** Commit `feat(inventories): listagem, abertura e menu`.

### Task 8: Tela de contagem (frontend)

**Files:** criar `inventory-count-page.tsx` e `inventory-count-table.tsx`.

**Interfaces — Consumes:** `inventoriesApi` (Task 7); `maskQuantity(raw): string` e `parseQuantity(masked): string | null` (`lib/masks.ts`); `formatDecimalString(value: string): string` (`modules/goods-exits/quantity.ts`).

- [ ] **Step 1:** Montar a página com cabeçalho, contadores, aviso de ferramentas (`hasTools` e aberto), barra de ações e busca local, tudo conforme a spec.
  - O estado `reveal` vem de `useState`, e o fechado força `true`.
  - O filtro *Todos / Só divergentes / Só não contados* só aparece revelado.
  - Zerar usa `ConfirmDialog`, com toast e invalidação do detalhe.
  - "Imprimir contagem" chama `openPdf(() => countSheet(id, { reveal }))`.
- [ ] **Step 2:** Montar a tabela com as colunas da spec.
  - **Destaque**: a linha `divergent` usa `bg-destructive/10`, e o não contado aparece como "—" com `text-muted-foreground`.
  - **Input**: só com `inventories.count` e aberto; nos demais casos, texto.
  - **Navegação**: o input de cada linha fica num `Map<itemId, HTMLInputElement>` de refs.
  - **Teclado e foco**:
    - Enter: valida, grava se mudou e foca o input da próxima linha **visível**;
    - blur com valor alterado: grava;
    - Esc: restaura o valor do servidor.
  - **Validação local**: `maskQuantity` com até 4 casas, ≥ 0. Inválido mostra erro na linha e não chama a API.
  - **Gravação**:
    - `useMutation` por chamada, com o estado por linha (`saving`/`error`) guardado num `Record<itemId, …>`;
    - em sucesso, `queryClient.setQueryData` troca só aquele item no cache do detalhe, sem refetch;
    - o detalhe revelado é invalidado (`['inventories', companyId, id, { reveal: true }]`) para recalcular a diferença na próxima vez que for exibido;
    - os contadores vêm do cache.
- [ ] **Step 3:** `tsc` limpo. Playwright (**RF 4**):
  - **Lançamento em sequência**: digitar `5,2` + Enter, `1.234,5` + Enter e vazio + Enter em três linhas seguidas, sem esperar. Os payloads (`page.on('request')`) trazem `"5.2"`, `"1234.5"` e `null`, e depois do reload os três valores persistem.
  - **Navegação e recusas**: o foco passa à próxima linha; `-1` e `1,23456` mostram erro sem request.
  - **Revelar**: a coluna Estoque não existe até "Verificar divergências"; depois aparece, e a linha divergente tem a classe de destaque.
  - **Zerar**: limpa tudo.
  - **Somente leitura**: com um perfil de só `view`, a tela não tem inputs.
- [ ] **Step 4:** Commit `feat(inventories): tela de contagem`.

### Task 9: Diálogo de fechamento (frontend)

**Files:** criar `close-inventory-dialog.tsx`; modificar `inventory-count-page.tsx`.

- [ ] **Step 1:** Montar o diálogo alimentado por `closePreview`:
  - resumo com os rótulos da spec ("Vão mudar de estoque");
  - alerta de não contados;
  - seções *Movimentados desde a abertura*, *Ferramentas emprestadas* e *Não ajustados*, só quando não estão vazias, com os textos da spec;
  - pergunta do Delphi e botão destrutivo "Fechar inventário".

  Em sucesso:
  - toast *"Inventário fechado."*;
  - invalida `inventories` e `products` da empresa;
  - a página recarrega fechada e revelada.

  A página abre o diálogo pelo botão ou por `?close=1`, e remove o parâmetro ao fechar o diálogo.
- [ ] **Step 2:** `tsc` limpo. Playwright, com o cenário da Task 4 recriado por API:
  - o diálogo mostra os números e as três seções;
  - confirmar fecha, e a tela fica sem inputs, com Estoque/Diferença visíveis e sem os botões Zerar, Fechar e Verificar;
  - a ação Fechar vinda da listagem abre o diálogo direto.
- [ ] **Step 3:** Commit `feat(inventories): fechar inventário na tela`.

### Task 10: Fechamento

**Files:** modificar `state.md`.

- [ ] **Step 1:** Rodar de novo todos os scripts das Tasks 2 a 6 e os de UI das Tasks 7 a 9: todos `ok`. Typechecks (backend e frontend) limpos.
- [ ] **Step 2:** Percorrer os **critérios de aceite** da spec um a um, anotando onde cada um foi verificado. O que faltar, verificar agora.
- [ ] **Step 3:** Atualizar o `state.md`:
  - as 3 tabelas novas (36 tabelas no total);
  - o módulo entregue;
  - as rotas backend e frontend;
  - o item de menu;
  - as permissões `inventories.*`, com a dependência de `product_groups.view` para `inventories.create`;
  - o 4º bloqueio do cancelamento da Entrada de mercadoria;
  - a data do snapshot.
- [ ] **Step 4:** Commit `docs(state): inventário de produtos`.

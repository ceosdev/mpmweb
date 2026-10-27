# Saída de Mercadoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar **Mercadoria → Saída de mercadoria**: requisição de produtos para um ativo ou funcionário, em dois tipos — **normal** (aberta → finalizada, baixa só o consumido) e **ferramenta** (aberta → entregue → devolvida) — com o tipo de produto **Ferramenta** e o **primeiro PDF do sistema** (protocolo em nova aba).

**Architecture:** Irmã da Entrada de Mercadoria: duas tabelas novas (`goods_exits`, `goods_exit_items`), service com CRUD + ações e um módulo de estoque próprio (`goods_exit_stock.ts`) chamado dentro da transação. O PDF nasce num módulo reutilizável `app/services/pdf/` (pdfmake no backend) e o frontend abre qualquer PDF por um helper único `openPdf`. Quantidade e custo trafegam como **string** e são calculados em `BigInt` escalado (`#utils/decimal`).

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL + `@adonisjs/drive`; **pdfmake 0.3.11** (novo); React 19 + Vite + TanStack Query + RHF + Zod + shadcn/ui + Tailwind v4.

**Spec:** [`docs/spec/movimentacao/003-criar-tela-saida-de-mercadoria.md`](../../spec/movimentacao/003-criar-tela-saida-de-mercadoria.md) (decisões em [`002-analise-saida-de-mercadoria.md`](../../spec/movimentacao/002-analise-saida-de-mercadoria.md)) — leia antes; mensagens exatas estão lá. Onde plano e spec divergirem, **a spec manda**. Referência de implementação: a Entrada de Mercadoria (`backend/app/services/goods_entry_service.ts`, `goods_entry_stock.ts`, `frontend/src/modules/goods-entries/`) — espelhe estrutura, nomes e idioma.

## Global Constraints

- **Idioma**: código em inglês; UI e mensagens da API em português.
- **Multitenant**: toda query filtra `tenant.company.id`; toda `queryKey` inclui `companyId`.
- **Camadas**: controller fino → service → repository → model.
- **Escrita multi-tabela em `db.transaction`**, `forUpdate()` na saída; produtos travados em **ordem crescente de id**.
- **Saldo** alterado por expressão SQL (`quantity_in_stock = coalesce(quantity_in_stock, 0) - ?`), nunca ler-somar-gravar.
- **Decimais**: quantidade `decimal(15,4)`, custo `decimal(20,10)`, como string na API; conta em `BigInt` via `#utils/decimal` (`toScaled`, `fromScaled`, `lineGrossCents`, `QTY_SCALE`, `PRICE_SCALE`). **Nunca `Number()`** em quantidade/custo no caminho de cálculo. Valores derivados em reais com 2 casas.
- **"Hoje"** = `todayIso()`.
- **Permissão nova = 2 arquivos**: `catalog.ts` e `module-labels.ts`.
- **Impressão = PDF em nova aba** (regra do sistema): nada de `window.print()`.
- **Cores só por token**; `PageHeader` com o ícone do menu (`PackageMinus`).
- **Sem testes automatizados** (decisão do usuário). Cada tarefa fecha com **typecheck + verificação executada + commit**.
- **Seed**: `node ace db:seed --files database/seeders/main_seeder.ts` (o `db:seed` puro roda o `suppliers_seeder` e insere fornecedores de exemplo).
- **Git**: branch `feat/goods-exits`. `git add` só dos arquivos da tarefa, nunca `-A`.

### Harness de verificação

Reusar `<scratchpad>/verify/api.mjs` (`login`, `loginAs(i)`, `api`, `check`) da sessão de Funcionários; se não existir, recriar conforme a seção *Harness de verificação* de [`2026-10-27-funcionarios.md`](./2026-10-27-funcionarios.md). Para ler PDFs, instale **só no scratchpad** `pdfjs-dist@4.10.38` (`npm i` dentro de `<scratchpad>/verify`) e extraia o texto com `getDocument({ data }).promise` → `getPage(1).getTextContent()`. Para a UI, Playwright headless: `playwright-core` em `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core`, Chromium em `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` (ver `ui-employees.mjs`). Cada script cria os próprios dados (produtos, funcionário, ativo) com sufixo aleatório.

## Review Focus

1. **Estoque mudou entre o preview e a confirmação** (outra saída consumiu o produto) — a finalização revalida contra o saldo **travado** e responde 422 nomeando o produto, sem gravar nada. Teste na Task 5.
2. **Produto legado com `controls_stock = true` e `quantity_in_stock = null`** — preview mostra estoque 0 e pré-preenche consumo 0; consumir > 0 dá 422; entregar ferramenta assim dá 422; devolver soma sobre `coalesce(…, 0)`. Teste na Task 5.
3. **Cancelar uma Entrada de Mercadoria cujas ferramentas estão entregues** — barrado pela regra existente de saldo negativo, nada muda. Teste na Task 5.
4. **Popup bloqueado** — o protocolo que abre sozinho depois de finalizar/entregar/devolver usa a aba aberta **no clique de confirmação**, antes do `await`; em erro da ação, a aba fecha. Teste na Task 9.
5. **Consumo digitado em pt-BR** (`0,5`, `1.234,5`) vira `"0.5"`/`"1234.5"` no payload; nunca `NaN`. Teste na Task 9.

---

## Estrutura de arquivos

**Backend — criar**
- `database/migrations/<ts>_create_goods_exits_table.ts`, `<ts>_create_goods_exit_items_table.ts`
- `app/models/goods_exit.ts`, `app/models/goods_exit_item.ts`
- `app/repositories/goods_exit_repository.ts`
- `app/validators/goods_exit_validators.ts`
- `app/services/goods_exit_service.ts` — CRUD, list, serialize, preview, finalize, deliver, return.
- `app/services/goods_exit_stock.ts` — trava, checagem e movimento de saldo.
- `app/services/pdf/pdf_service.ts` — `renderPdf`, `companyHeader`, formatadores pt-BR.
- `app/services/pdf/goods_exit_protocol.ts` — definição do protocolo.
- `app/controllers/goods_exits_controller.ts`

**Backend — modificar**: `app/models/product.ts`, `app/validators/product_validators.ts`, `app/services/product_service.ts`, `app/controllers/products_controller.ts` (tipo `tool`, filtros do lookup); `app/services/employee_service.ts`, `app/controllers/employees_controller.ts`; `app/services/product_asset_service.ts`, `app/controllers/product_assets_controller.ts`; `app/abilities/catalog.ts`; `start/routes.ts`; `package.json`.

**Frontend — criar**: `src/lib/open-pdf.ts`; `src/services/goods-exits-api.ts`; `src/modules/goods-exits/` — `goods-exits-page.tsx`, `goods-exit-form-page.tsx`, `goods-exit-form-values.ts`, `goods-exit-items-section.tsx`, `finalize-goods-exit-dialog.tsx`, `goods-exit-status-badge.tsx`.

**Frontend — modificar**: `src/types/api.ts`, `src/services/lookup-api.ts`, `src/components/common/entity-picker/entity-sources.ts`, `src/modules/products/products-page.tsx`, `src/modules/products/product-form-dialog.tsx`, `src/modules/goods-entries/goods-entry-form-values.ts`, `src/permissions/module-labels.ts`, `src/permissions/menu.ts`, `src/routes/router.tsx`.

**Docs**: `state.md`.

---

### Task 1: Produto do tipo Ferramenta

**Files:** modify `product.ts`, `product_validators.ts`, `product_service.ts` (backend); `types/api.ts`, `products-page.tsx`, `product-form-dialog.tsx`, `goods-entry-form-values.ts`, `entity-sources.ts` (frontend).

**Interfaces — Produces:** `ProductType = 'consumable' | 'fixed_asset' | 'tool'` (backend e frontend); rótulo `tool: 'Ferramenta'`.

Regras: no create/update o service força `controlsStock = true` quando o tipo **final** é `tool` (espelhando o `false` forçado de `fixed_asset`, `product_service.ts:218` e `:266`); `STOCK_SORT_SQL` trata `tool` como consumo. No form de Produtos, "Controla estoque" fica marcado e desabilitado para Ferramenta; o sublabel do picker de produto mostra "Ferramenta".

- [ ] **Step 1:** Backend: tipo, validator (`PRODUCT_TYPES`), regra de `controlsStock` no service.
- [ ] **Step 2:** Frontend: tipos, `Select` do form e do filtro, switch travado, rótulo da listagem, `goods-entry-form-values.ts` (`productType` aceita `tool`), sublabel em `entity-sources.ts` (`fixed_asset` → "Ativo", `tool` → "Ferramenta", senão "Consumo").
- [ ] **Step 3:** Script `<scratchpad>/verify/tool-product.mjs`: criar produto `tool` com `controlsStock: false` → 201 com `controlsStock: true`; editar para `controlsStock: false` → continua `true`; mudar para `consumable` permite desligar; criar entrada de mercadoria com a ferramenta (2 un. a R$ 10,00), finalizar → saldo 2 e `costPrice` `"10.0000000000"`; `GET /products?type=tool` lista só ferramentas.
- [ ] **Step 4:** `npm run typecheck` e `npx tsc -p tsconfig.app.json --noEmit` limpos. Commit `feat(products): tipo de produto Ferramenta`.

### Task 2: Lookups para os pickers da saída

**Files:** modify `employee_service.ts`, `employees_controller.ts`, `product_asset_service.ts`, `product_assets_controller.ts`, `product_service.ts`, `products_controller.ts`, `start/routes.ts`, `lookup-api.ts`, `entity-sources.ts`, `types/api.ts`.

**Interfaces — Produces:**
- `GET /employees/lookup` → `{ data: { id, name, roleTitle, isActive }[], hasMore }`; `?q=` só ativos, por nome ou código (`lookupCodeId`); `?ids=` hidrata qualquer um. Sem gate de rota (registrar **antes** de `/employees/:id`).
- `GET /product-assets/lookup` → `{ id, description, assetCode, productId, productDescription, situation }`; `?q=` exclui `situation = 'sold'` e casa descrição do ativo, descrição do produto, `asset_code` ou código; `?ids=` hidrata qualquer um. Sem gate de rota.
- `GET /products/lookup` aceita `type` (`consumable` | `fixed_asset` | `tool`) e `controlsStock` (`true`), aplicados só em `?q=`. `canSeeCost` (`product_service.ts:169`) passa a incluir `goods_exits.create` e `goods_exits.edit`.
- Frontend: `lookupApi<T>(resource, extraParams?: Record<string, string>)` mescla `extraParams` só na busca por termo. Fontes novas em `ENTITY_SOURCES`: `employee`, `productAsset` (label "produto – descrição", sublabel `#id · patrimônio` ou "Sem patrimônio"), `consumableStockProduct` (`type=consumable&controlsStock=true`) e `toolProduct` (`type=tool&controlsStock=true`) — as duas últimas reusam `toProductOption`. Tipos `EmployeeLookup`, `ProductAssetLookup` em `types/api.ts`.

- [ ] **Step 1:** Backend: os três lookups (mesmo estilo de `CustomerService.lookup`, com `lookupValidator`/`parseLookupIds`).
- [ ] **Step 2:** Frontend: `lookupApi` com `extraParams` e as 4 fontes.
- [ ] **Step 3:** Script `lookups.mjs`: funcionário inativo não vem em `?q=` mas vem em `?ids=`; ativo vendido idem; `?q=` pelo código do patrimônio acha o ativo; `products/lookup?q=…&type=tool&controlsStock=true` traz a ferramenta e não o consumo; consumo sem controle de estoque não vem com `controlsStock=true`; nada de outra empresa (`loginAs(1)`).
- [ ] **Step 4:** typechecks limpos. Commit `feat(lookups): funcionários, ativos e filtros de produto`.

### Task 3: Tabelas, models e permissões da saída

**Files:** create as 2 migrations, `goods_exit.ts`, `goods_exit_item.ts`; modify `catalog.ts`, `module-labels.ts`.

**Interfaces — Produces:**
- Tabelas exatamente como a seção *Campos* da spec, com `goods_exits_consumer_chk`, `goods_exits_tool_employee_chk` (via `this.schema.raw`) e `goods_exit_items_exit_product_uq`.
- `GoodsExit` (`exitType: 'normal' | 'tool'`, `consumerType: 'asset' | 'employee'`, `productAssetId`, `employeeId`, `operationDate: DateTime`, `requestedByUserId`, `notes`, `status: GoodsExitStatus`, `finalizedAt`, `deliveredAt`, `returnedAt`), `hasMany items`, `belongsTo employee/productAsset/requestedBy`. `GoodsExitStatus = 'open' | 'finalized' | 'delivered' | 'returned'`.
- `GoodsExitItem` (`requestedQuantity: string`, `consumedQuantity: string | null`, `unitCost: string | null` — decimais como string, como em `GoodsEntryItem`), `belongsTo product`.
- Catálogo: 7 permissões com os `name` da spec, `module: 'goods_exits'`, após `goods_entries.*`; label `goods_exits: 'Saídas de mercadoria'`.

- [ ] **Step 1:** Migrations + models.
- [ ] **Step 2:** Catálogo + label; `node ace migration:run` → `node ace migration:rollback` (desfaz só o último batch) → `node ace migration:run`, todos ok; seed só do `main_seeder`.
- [ ] **Step 3:** `psql`: os 2 checks e o unique existem; `insert` manual de uma saída `tool` com consumidor `asset` falha no check.
- [ ] **Step 4:** typecheck limpo. Commit `feat(goods-exits): tabelas, models e permissões`.

### Task 4: CRUD da saída (backend)

**Files:** create `goods_exit_repository.ts`, `goods_exit_validators.ts`, `goods_exit_service.ts` (CRUD/list/serialize), `goods_exits_controller.ts`; modify `start/routes.ts`.

**Interfaces — Consumes:** models (Task 3); `#utils/decimal`.

**Interfaces — Produces:**
- Payload de salvar: `{ exitType, consumerType, productAssetId?, employeeId?, notes?, items: { productId: number; requestedQuantity: string }[] }` (`requestedQuantity` por regex `^\d{1,11}(\.\d{1,4})?$`, > 0 checado no service).
- `serialize(row, items?)` → cabeçalho com `consumerName` (nome do funcionário, ou `"<produto> – <descrição do ativo>"`), `consumerLabel` ("Funcionário" / "Ativo"), `assetCode`, `requestedByName`, `requestedValue`, `consumedValue` (reais, `number`); itens com `productDescription`, `unitOfMeasure`, `requestedQuantity`/`consumedQuantity`/`unitCost` (string), `requestedValue`/`consumedValue` (reais).
- `goodsExitService.list/show/create/update/destroy`; `SORT_EXPRESSIONS`: `consumer` (subquery do nome exibido), `requested_value`, `consumed_value` (subqueries `Σ round(qtd × unit_cost, 2)` — a mesma expressão do select), `status` (`CASE` aberta → entregue → finalizada → devolvida); filtros `id`, `consumer`, `exitType`, `operationFrom`/`operationTo`, `statuses[]`.
- Rotas `GET|POST /goods-exits`, `GET|PUT|DELETE /goods-exits/:id` com as permissões.

Regras (todas da spec, *Regras de negócio → Salvar*): relações do tenant; produto ativo, controla estoque e do tipo da saída; ferramenta com custo nulo/zero → 422; repetido → 422; consumidor válido (edição aceita o vínculo já gravado); `exitType` imutável; `unit_cost` = `cost_price` atual ao salvar; edição/exclusão só `open`; itens substituídos em bloco na transação.

- [ ] **Step 1:** Repository, validators, service CRUD, controller, rotas.
- [ ] **Step 2:** Script `goods-exits-crud.mjs`: criar normal p/ funcionário e p/ ativo → 201 com `status: 'open'`, `operationDate` hoje, `requestedByName`; `requestedValue` = 2 × 138,90 = 277,80; ferramenta p/ ativo → 422; produto `tool` numa normal → 422; consumo sem controle de estoque → 422; ferramenta com custo 0 → 422; repetido → 422; qtd `'0'` → 422; funcionário inativo → 422, mas editar uma saída já gravada com ele → 200; ativo vendido → 422; trocar `exitType` → 422; editar substitui itens; listagem: filtros e `sort=consumer|requested_value|status` asc/desc coerentes; excluir aberta → 204; excluir funcionário/produto usado → 409.
- [ ] **Step 3:** typecheck limpo. Commit `feat(goods-exits): CRUD da saída de mercadoria`.

### Task 5: Finalizar, entregar e devolver (backend)

**Files:** create `goods_exit_stock.ts`; modify `goods_exit_service.ts`, `goods_exits_controller.ts`, `start/routes.ts`.

**Interfaces — Produces:**
- `goods_exit_stock.ts`: `lockProducts(trx, companyId, productIds): Promise<Map<number, Product>>` (ordem crescente de id, `forUpdate`); `moveStock(trx, productId, delta: string): Promise<void>` (expressão SQL com `coalesce`).
- `finalizePreview(tenant, id)` → `{ items: { productId, productDescription, unitOfMeasure, stock: string, requestedQuantity, suggestedConsumed: string, unitCost }[] }` (`suggestedConsumed = max(0, min(requested, stock))`).
- `finalize(tenant, id, items: { productId; consumedQuantity: string }[])`, `deliver(tenant, id)`, `returnTools(tenant, id)` — cada um devolve a saída serializada.
- Rotas: `GET /goods-exits/:id/finalize-preview` e `POST …/finalize` (`goods_exits.finalize`), `POST …/deliver` (`goods_exits.deliver`), `POST …/return` (`goods_exits.return`).

Transações e mensagens exatamente como a spec (*Finalizar*, *Entregar*, *Devolver*). `finalize` exige exatamente os itens da saída (faltando/sobrando → 422).

- [ ] **Step 1:** `goods_exit_stock.ts` + as quatro ações + rotas.
- [ ] **Step 2:** Script `goods-exits-actions.mjs` (cada cenário com produtos próprios, saldo inicial por Entrada de Mercadoria finalizada):
  - finalizar normal (req 3, estoque 10, consumo 2) → saldo 8, `consumedQuantity '2.0000'`, `unitCost` = custo atual, status `finalized`; refinalizar → 422; editar/excluir → 422;
  - consumo > requisitado → 422; consumo > estoque → 422 com o nome do produto; consumo 0 → aceito, saldo inalterado; consumo `'0.5'` → saldo `9.5000`;
  - **RF 1**: preview com estoque 5, outra saída consome 4, finalizar a primeira com 5 → 422, saldo continua 1;
  - duas saídas finalizadas em sequência do mesmo produto → saldo exato;
  - **RF 2**: produto com `quantity_in_stock = null` (setar por `psql`) → preview `stock '0'`/`suggestedConsumed '0'`; consumir 1 → 422; ferramenta assim → entregar 422;
  - entregar ferramenta sem saldo → 422, nada muda; com saldo → baixa o requisitado, `delivered`; finalizar uma ferramenta → 422; devolver → soma de volta, `returned`; devolver de novo → 422;
  - **RF 3**: entrada de mercadoria de 2 ferramentas, saída entregue de 2, cancelar a entrada → 422 (saldo negativo), saldo e status intactos;
  - `finalize` com item a menos/a mais → 422; ações em saída de outra empresa → 404.
- [ ] **Step 3:** typecheck limpo. Commit `feat(goods-exits): finalizar, entregar e devolver`.

### Task 6: Protocolo em PDF (backend)

**Files:** modify `backend/package.json` (+ lock); create `app/services/pdf/pdf_service.ts`, `app/services/pdf/goods_exit_protocol.ts`; modify `goods_exits_controller.ts`, `start/routes.ts`.

**Interfaces — Produces:**
- `renderPdf(doc: TDocumentDefinitions): Promise<Buffer>` — fontes Roboto que vêm no pacote.
- `companyHeader(company: Company): Promise<Content>` — logo via `drive.use(<disco do logo>)` a partir de `company.logoPath` (reusar a extração de chave de `company_service.ts:314`); sem logo ou falha de leitura, só texto.
- `formatQuantityPtBr(value: string): string` (`'1.2500'` → `'1,25'`, `'2.0000'` → `'2'`), `formatDatePtBr(iso: string): string`.
- `buildGoodsExitProtocol(exit, company): Promise<TDocumentDefinitions>`.
- `GET /goods-exits/:id/protocol` (`goods_exits.view`) → `content-type: application/pdf`, `content-disposition: inline; filename="saida-<id>.pdf"`; aberta → 422 da spec.

- [ ] **Step 1:** `npm i pdfmake@0.3.11` (exato, sem `^`) e, se o pacote não trouxer tipos, `@types/pdfmake` na versão compatível como devDependency. Antes de escrever o service, **leia o README/tipos do pacote instalado** para a API server-side da 0.3 (instância, `setFonts`/fontes, obtenção do Buffer) e o caminho das TTFs Roboto — não adivinhe a API da 0.2 (`PdfPrinter`).
- [ ] **Step 2:** `pdf_service.ts`, `goods_exit_protocol.ts` (conteúdo da seção *Protocolo (PDF)* da spec), action e rota.
- [ ] **Step 3:** Script `protocol.mjs` (com `pdfjs-dist` do scratchpad): saída aberta → 422; finalizada → 200, `application/pdf`, bytes começam com `%PDF-`; texto contém "Protocolo de Saída de Mercadoria", `0000000001`-style do id, a razão social da empresa, "FUNCIONÁRIO:" + nome, o produto e as duas quantidades formatadas (`2`, `0,5`); ferramenta devolvida → tabela sem "Qtd. consumida"; empresa sem logo (segunda empresa, ou `logo_path` nulo) também gera; saída de outra empresa → 404.
- [ ] **Step 4:** typecheck limpo. Commit `feat(goods-exits): protocolo em PDF`.

### Task 7: Listagem, menu e rotas (frontend)

**Files:** create `goods-exits-api.ts`, `goods-exits-page.tsx`, `goods-exit-status-badge.tsx`, `lib/open-pdf.ts`; modify `types/api.ts`, `menu.ts`, `router.tsx`.

**Interfaces — Produces:**
- `goodsExitsApi`: `list`, `get`, `create`, `update`, `remove`, `finalizePreview`, `finalize(id, items)`, `deliver`, `returnTools`, `protocol(id): Promise<Blob>` (`responseType: 'blob'`).
- Tipos `GoodsExit`, `GoodsExitItem`, `GoodsExitStatus`, `GoodsExitFinalizePreview`, `GoodsExitPayload`.
- `openPdf(fetchPdf: () => Promise<Blob>, tab?: Window | null): Promise<void>` — sem `tab`, abre `window.open('', '_blank')` na hora; baixa; `tab.location.href = URL.createObjectURL(blob)`; em erro fecha a aba e `toast.error(getErrorMessage(error))`. Para os disparos automáticos (Task 9) a aba é aberta pelo chamador no clique e passada como `tab`. Um erro de blob vindo do axios precisa ter o JSON lido (`await error.response.data.text()`) para a mensagem da API aparecer.
- Query keys `['goods-exits', companyId, …]`; ações invalidam `goods-exits` e `products` da empresa.

- [ ] **Step 1:** Listagem espelhando `goods-entries-page.tsx`: filtros da spec, colunas, ordenação, menu Ações pela tabela de ações da spec; Excluir com `ConfirmDialog`; "Imprimir protocolo" chama `openPdf(() => goodsExitsApi.protocol(id))`. Finalizar/Entregar/Devolver: deixe os ganchos para a Task 9.
- [ ] **Step 2:** Menu "Saída de mercadoria" (`PackageMinus`, `goods_exits.view`) depois de "Entrada de mercadoria"; rotas `/goods-exits`, `/goods-exits/new`, `/goods-exits/:id`, `/goods-exits/:id/edit` em `PermissionRoute` (view / create / view / edit).
- [ ] **Step 3:** `npx tsc -p tsconfig.app.json --noEmit` limpo; Playwright: listagem abre com o filtro de data do mês, lista as saídas criadas pelos scripts, ordena por todas as colunas; "Imprimir protocolo" de uma finalizada abre uma segunda página (`context.waitForEvent('page')`) cuja URL começa com `blob:`; o item não aparece numa saída aberta.
- [ ] **Step 4:** Commit `feat(goods-exits): listagem, menu e impressão do protocolo`.

### Task 8: Formulário da saída (frontend)

**Files:** create `goods-exit-form-page.tsx`, `goods-exit-form-values.ts`, `goods-exit-items-section.tsx`.

**Interfaces — Consumes:** fontes `employee`, `productAsset`, `consumableStockProduct`, `toolProduct` (Task 2); `goodsExitsApi` (Task 7); máscaras de quantidade da Entrada de Mercadoria (`maskQuantity` / `parseQuantity` de `lib/masks.ts`; `parseQuantity` devolve a string `"1234.5"` ou `null`) — também no input de consumo da Task 9.

- [ ] **Step 1:** Form em rota dedicada espelhando `goods-entry-form-page.tsx`, seções e campos da spec (*Cadastro — fluxo feliz*); `readOnly` em `/goods-exits/:id`.
- [ ] **Step 2:** Comportamentos: *Saída de ferramentas* trava o tipo de consumidor em Funcionário; trocar tipo de consumidor limpa o consumidor; trocar tipo de saída com itens pede confirmação e limpa os itens; o picker de produto usa `consumableStockProduct` ou `toolProduct`; produto repetido → *"Este produto já está na saída."*; rodapé com quantidade de produtos e total requisitado (`lineGrossCents(qtd, costPrice)`).
- [ ] **Step 3:** typecheck limpo; Playwright: criar saída normal p/ funcionário com 2 produtos e uma de ferramenta (o select de consumidor fica travado); trocar o tipo com itens → confirmação → lista vazia; produto repetido mostra a mensagem; editar reabre os valores; a visualização não tem campos editáveis.
- [ ] **Step 4:** Commit `feat(goods-exits): formulário da saída`.

### Task 9: Finalizar, entregar e devolver (frontend)

**Files:** create `finalize-goods-exit-dialog.tsx`; modify `goods-exits-page.tsx`.

- [ ] **Step 1:** Diálogo de finalização: `useQuery` no preview; tabela Código / Produto / Estoque / Qtd. requisitada / **Qtd. consumida** (input pt-BR, pré-preenchido com `suggestedConsumed`) / Valor consumido; total consumido; validação local com as mensagens da spec; "Finalizar" → `ConfirmDialog` → no clique de **Sim**: `const tab = window.open('', '_blank')`, `await finalize(...)`, depois `openPdf(() => protocol(id), tab)`; erro da ação → `tab?.close()` e toast.
- [ ] **Step 2:** Entregar e Devolver: `ConfirmDialog` com as frases da spec e a lista de ferramentas/quantidades; mesmo padrão de aba aberta no clique.
- [ ] **Step 3:** typecheck limpo; Playwright: finalizar digitando `0,5` num item → payload (`page.on('request')`) traz `"0.5"` (RF 5); depois do Sim abre uma nova página `blob:` (RF 4); uma finalização recusada (consumo > estoque forçado pela API) fecha a aba extra e mostra o toast; entregar e devolver uma ferramenta abrem o protocolo; os status e o menu Ações mudam conforme a spec.
- [ ] **Step 4:** Commit `feat(goods-exits): finalizar, entregar e devolver na tela`.

### Task 10: Fechamento

**Files:** modify `state.md`.

- [ ] **Step 1:** Rodar de novo todos os scripts das Tasks 1, 2, 4, 5, 6 e os de UI → todos `ok`; typechecks limpos.
- [ ] **Step 2:** Percorrer os **critérios de aceite** da spec um a um, anotando onde cada um foi verificado; o que faltar, verificar agora.
- [ ] **Step 3:** `state.md`: tabelas `goods_exits`/`goods_exit_items` (33 tabelas), tipo `tool` em `products`, módulo entregue, rotas backend/frontend (incluindo os 3 lookups e o `/protocol`), item de menu, convenção **impressão = PDF em nova aba** (`openPdf` + `app/services/pdf/`), remover a pendência "Saída de Mercadoria" e a "Devolução de material" (resolvida), data do snapshot.
- [ ] **Step 4:** Commit `docs(state): saída de mercadoria`.

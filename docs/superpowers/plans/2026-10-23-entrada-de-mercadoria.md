# Entrada de Mercadoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar **Movimentação → Entrada de Mercadoria**: cadastro da nota de compra (cabeçalho + produtos) que, ao ser **finalizada**, gera os títulos a pagar (com vencimentos editáveis), soma estoque e recalcula custo dos produtos e cria um ativo por unidade de produto imobilizado; e que, ao ser **cancelada**, desfaz tudo ou recusa com 422.

**Architecture:** Irmã da Entrada de Serviço: duas tabelas novas (`goods_entries`, `goods_entry_items`), coluna de origem `goods_entry_id` em `payables` e `product_assets`, e ampliação de precisão em `products`. O efeito em produto (estoque, custo, ativos — aplicar e estornar) vive num módulo próprio, `goods_entry_stock.ts`, chamado pelo service dentro da mesma transação. Toda conta com quantidade/preço/custo usa `BigInt` escalado (`#utils/decimal.ts`); esses valores trafegam como **string** na API.

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL; React 19 + Vite + TanStack Query + RHF + Zod + shadcn/ui + Tailwind v4. Luxon para datas.

**Spec:** [`docs/spec/movimentacao/001-criar-tela-entrada-de-mercadoria.md`](../../spec/movimentacao/001-criar-tela-entrada-de-mercadoria.md) — leia antes. Onde plano e spec divergirem, **a spec manda**. Referência de implementação: o módulo Entrada de Serviço (`backend/app/services/service_entry_service.ts`, `frontend/src/modules/service-entries/`) — espelhe estrutura, nomes e idioma dele.

## Global Constraints

- **Idioma**: código em inglês; textos de UI e mensagens de erro da API em português. Mensagens exatas estão na spec — copie-as.
- **Multitenant**: toda query filtra `tenant.company.id`; toda `queryKey` inclui `companyId`.
- **Camadas**: Controller fino → Service → Repository → Model.
- **Escrita multi-tabela em `db.transaction`**, `forUpdate()` no pai; produtos travados em **ordem crescente de id**.
- **Saldo** alterado por expressão SQL (`quantity_in_stock = coalesce(quantity_in_stock, 0) + ?`), nunca ler-somar-gravar.
- **Decimais**: quantidade `decimal(15,4)`, preço `decimal(20,10)`, custo `decimal(20,10)`; conta em `BigInt` escalado, half-up. **Nunca `Number()` em quantidade/preço/custo** no caminho de cálculo. Monetários `decimal(12,2)` seguem em centavos `number` como na Entrada de Serviço.
- **"Hoje"** = `todayIso()`; datas date-only no frontend com `formatIsoDate`.
- **Permissão nova = 2 arquivos**: `catalog.ts` e `module-labels.ts`.
- **Cores só por token.** `PageHeader` com o ícone do item de menu.
- **Sem testes automatizados** (decisão do usuário, mantida desde a Entrada de Serviço). Cada tarefa fecha com **typecheck + verificação executada** (script de API no scratchpad ou conferência na UI).
- **Git**: trabalhar no branch `feat/goods-entries`. `git add` só dos arquivos da tarefa (o `.gitignore` modificado na árvore é do usuário — não commitar sem ele pedir). Commits só com autorização do usuário.

### Harness de verificação

Reusar o harness da Entrada de Serviço (`docs/superpowers/plans/2026-08-16-entrada-de-servico.md`, seção *Harness de verificação*): `login()`, `api()`, `check()` em `<scratchpad>/verify/api.mjs`. Backend rodando (`cd backend && npm run dev`). Cada script de verificação cria seus próprios dados (fornecedor, produtos, tipos) com sufixo aleatório e não depende de dados anteriores.

## Review Focus

1. **Duas entradas finalizadas sobre o mesmo produto** — saldo e custo médio acumulam corretamente (10@3 → +10@4 → +20@5 ⇒ 40 un., custo 4,25). Teste na Task 6.
2. **Produto alterado entre salvar e finalizar** (vira `fixed_asset` com qtd 1,5; ou deixa de controlar estoque) — a finalização usa o estado atual e responde 422 no caso fracionado; o cancelamento usa `stock_effect`. Teste na Task 6.
3. **Cancelar a primeira de duas entradas** do mesmo produto — estorna só a quantidade dela, custo não muda. Teste na Task 6.
4. **Entrada pt-BR de números** — `1.234,5678` vira `"1234.5678"`, `0,0325` vira `"0.0325"`, colar `12500` vira `"12500"`; nada de `NaN`/notação científica no payload. Teste na Task 9.
5. **Produto legado com `controls_stock = true` e `quantity_in_stock`/`cost_price` `null`** — saldo vira a qtd da entrada, custo vira o da entrada (sem divisão por zero). Teste na Task 6.

---

## Estrutura de arquivos

**Backend — criar**
- `app/utils/decimal.ts` — aritmética `BigInt` escalada (puro).
- `database/migrations/<ts>_alter_products_precision.ts`
- `database/migrations/<ts>_create_goods_entries_table.ts`
- `database/migrations/<ts>_create_goods_entry_items_table.ts`
- `database/migrations/<ts>_add_goods_entry_id_to_payables.ts`
- `database/migrations/<ts>_add_goods_entry_id_to_product_assets.ts`
- `app/models/goods_entry.ts`, `app/models/goods_entry_item.ts`
- `app/repositories/goods_entry_repository.ts`
- `app/services/goods_entry_service.ts` — CRUD, list, preview, finalize, cancel.
- `app/services/goods_entry_stock.ts` — efeito em produto (aplicar/verificar/estornar).
- `app/validators/goods_entry_validators.ts`
- `app/controllers/goods_entries_controller.ts`

**Backend — modificar**
- `app/models/product.ts`, `app/services/product_service.ts`, `app/validators/product_validators.ts`, `app/controllers/products_controller.ts` (precisão + lookup)
- `app/models/payable.ts`, `app/services/payable_service.ts` (`goodsEntryId` no DTO de `createFromSource`)
- `app/models/product_asset.ts` (`goodsEntryId`)
- `app/abilities/catalog.ts`, `start/routes.ts`

**Frontend — criar**
- `src/lib/decimal.ts` — `lineGrossCents` espelhado + parse/format de string decimal.
- `src/services/goods-entries-api.ts`
- `src/modules/goods-entries/goods-entries-page.tsx`, `goods-entry-form-page.tsx`, `goods-entry-items-section.tsx`, `goods-entry-status-badge.tsx`, `finalize-goods-entry-dialog.tsx`

**Frontend — modificar**
- `src/lib/masks.ts` (quantidade 4 casas; `maskDecimalPrice`/`formatDecimalPrice`)
- `src/modules/products/product-form-dialog.tsx`, `products-page.tsx`
- `src/services/lookup-api.ts`, `src/components/common/entity-picker/entity-sources.ts`
- `src/types/api.ts`, `src/permissions/module-labels.ts`, `src/permissions/menu.ts`, `src/routes/router.tsx`

---

### Task 1: Aritmética decimal (`#utils/decimal.ts`)

**Files:** Create `backend/app/utils/decimal.ts`

**Interfaces — Produces** (todas puras, sem dependência):
- `toScaled(value: string | number, scale: number): bigint` — `'2.53'`,4 → `25300n`; aceita string do `pg` (`'2.5300'`) e inteiros; lança `Error` para formato inválido.
- `fromScaled(value: bigint, scale: number): string` — `25300n`,4 → `'2.5300'`; negativos com sinal.
- `divRoundHalfUp(numerator: bigint, denominator: bigint): bigint` — divisão inteira com half-up (sinal-correta); lança para denominador 0.
- `lineGrossCents(quantity: string, unitPrice: string): bigint` — `round(q × p, 2)` half-up; `('2.53','3.4567')` → `875n`.
- `unitCostFromLine(lineNetCents: bigint, quantity: string): string` — custo unitário, escala 10; `(3500n,'10')` → `'3.5000000000'`.
- `weightedAverageCost(p: { stock: string | null; cost: string | null; quantity: string; lineNetCents: bigint }): string` — regra da spec: `stock ≤ 0` ou `cost null` → `unitCostFromLine`; senão `(stock×cost + lineNet) ÷ (stock+qty)`, escala 10.
- Constantes `QTY_SCALE = 4`, `PRICE_SCALE = 10`.

- [ ] **Step 1:** Implementar as funções. Escala interna: produto de qtd (4) × preço (10) = escala 14; reduzir para centavos com `divRoundHalfUp(x, 10n ** 12n)`.
- [ ] **Step 2:** Verificar com script descartável executado por `node ace repl` ou equivalente (importando `#utils/decimal`), conferindo: `lineGrossCents('2.53','3.4567') === 875n`; `lineGrossCents('0.8334','43.2') === 3600n` (36,00288 → 36,00); `weightedAverageCost({stock:'10',cost:'3',quantity:'10',lineNetCents:4000n}) === '3.5000000000'`; `weightedAverageCost({stock:null,cost:null,quantity:'5',lineNetCents:1000n}) === '2.0000000000'`; `weightedAverageCost({stock:'-2',cost:'9',quantity:'4',lineNetCents:800n}) === '2.0000000000'`; `divRoundHalfUp(5n,2n) === 3n`, `divRoundHalfUp(-5n,2n) === -3n`.
- [ ] **Step 3:** `cd backend && npm run typecheck` → sem erros.
- [ ] **Step 4:** Commit `feat(decimal): aritmética BigInt escalada para quantidade, preço e custo`.

### Task 2: Migrations + models

**Files:** as 5 migrations; create `goods_entry.ts`, `goods_entry_item.ts`, `goods_entry_repository.ts`; modify `product.ts`, `payable.ts`, `product_asset.ts`.

**Interfaces — Produces:**
- `GoodsEntry` model: colunas da spec em camelCase (`documentTypeId`, `documentNumber`, `series`, `subSeries`, `issueDate`, `operationDate`, `supplierId`, `discount`, `icmsSt`, `ipi`, `freight`, `insurance`, `otherExpenses`, `paymentTypeId`, `installmentCount`, `firstDueDate`, `status`, `finalizedAt`); `belongsTo` `supplier`, `documentType`, `paymentType`; `hasMany` `items`. `export const GOODS_ENTRY_STATUSES = ['open','finalized','cancelled'] as const; export type GoodsEntryStatus`.
- `GoodsEntryItem` model: `goodsEntryId`, `productId`, `quantity: string`, `unitPrice: string`, `discount`, `stockEffect: StockEffect | null`; `belongsTo product`. `export type StockEffect = 'stock' | 'none' | 'asset'`.
- `Product`: `quantityInStock`, `minimumStock`, `costPrice` tipados **`string | null`** (o driver devolve string; não converter).
- `Payable.goodsEntryId: number | null`; `ProductAsset.goodsEntryId: number | null`.
- `goodsEntryRepository.query(companyId)`, `.findById(companyId, id)` — mesmo formato de `service_entry_repository.ts`.

- [ ] **Step 1:** Migrations exatamente como a seção *Migrations* da spec (nomes de índice/unique inclusos). `alter_products_precision`: `table.decimal(col, p, s).alter()` nos três campos; `down` volta a `(12,3)`/`(12,2)`.
- [ ] **Step 2:** Models e repository.
- [ ] **Step 3:** `node ace migration:run` → ok; `node ace migration:rollback` (desfaz só o lote novo) e `node ace migration:run` de novo → ambos limpos. Conferir com `psql` que um produto existente manteve `quantity_in_stock`/`cost_price`.
- [ ] **Step 4:** Ajustar usos de `quantityInStock`/`minimumStock`/`costPrice` que o typecheck apontar em `product_service.ts` (comparações de estoque baixo seguem no SQL; serialização devolve `costPrice` como string e quantidades como `Number(...)` — seguro até 15 dígitos).
- [ ] **Step 5:** `npm run typecheck` → ok. Commit `feat(goods-entries): schema, models e ampliação de precisão de produtos`.

### Task 3: Produtos — precisão no backend e lookup com custo condicional

**Files:** modify `product_validators.ts`, `product_service.ts`, `products_controller.ts`, `start/routes.ts`.

**Interfaces — Produces:**
- `GET /api/products/lookup` (auth + tenant, **sem** `permission`), registrado **antes** de `/products/:id`. `?q=` (descrição contém, case-insensitive, `lookupCodeId` para id exato; só ativos; `limit+1` para `hasMore`), `?ids=` (hidrata, inclui inativos). Reusa `lookupValidator` e `parseLookupIds`.
- `productService.lookup(tenant, params): Promise<{ data: ProductLookup[]; hasMore: boolean }>` com `ProductLookup = { id; description; type; controlsStock; unitOfMeasure: string | null; costPrice: string | null; isActive }`.
- `costPrice` preenchido só se `tenant.can('products.view') || tenant.can('goods_entries.create') || tenant.can('goods_entries.edit')` (ROOT passa por `can`); senão `null`.
- Validator de produto: `costPrice` string `^\d{1,10}(\.\d{1,10})?$` opcional/nullable; `quantityInStock`/`minimumStock` aceitam até 4 casas.

- [ ] **Step 1:** Implementar validator, service `lookup` (preload `unitOfMeasure`) e controller + rota.
- [ ] **Step 2:** Verificar por script: ROOT busca `q` = parte da descrição → acha, `costPrice` string; busca pelo id numérico → acha; produto inativo não vem em `q` mas vem em `ids`; criar um perfil só com `goods_entries.view` (sem `products.view`), usuário com esse perfil → lookup 200 com `costPrice: null`; com `goods_entries.create` → preenchido. Salvar produto com `costPrice: "3.4566666667"` e `quantityInStock: 2.5375` → lidos de volta iguais.
- [ ] **Step 3:** typecheck; commit `feat(products): lookup do EntityPicker e precisão de custo/estoque`.

### Task 4: Produtos — precisão no frontend + fonte `product` do EntityPicker

**Files:** modify `lib/masks.ts`, `product-form-dialog.tsx`, `products-page.tsx`, `lookup-api.ts`, `entity-sources.ts`, `types/api.ts`.

**Interfaces — Produces:**
- `maskQuantity`/`parseDecimal`/`formatQuantity` com **4** casas.
- `maskDecimalPrice(raw: string): string` (até 10 casas, vírgula pt-BR, milhar com ponto); `parseDecimalPrice(masked: string): string | null` → string decimal com ponto (`'1.234,5678'` → `'1234.5678'`), **sem passar por `Number`**; `formatDecimalPrice(value: string | null, maxFraction = 10): string` — casas significativas, mínimo 2.
- `Product.costPrice: string | null` em `types/api.ts`; `ProductLookup` type; `productLookupApi.search/byIds`.
- `productSource` no registry: placeholder *"Buscar produto por código ou descrição..."*, empty *"Nenhum produto encontrado."*, sublabel `#id · Ativo|Consumo · <unidade>`; a `EntityOption` carrega o lookup cru em um campo extra (`data?: unknown` em `EntityOption` se ainda não existir) para a tela da entrada ler `costPrice`/`type`.

- [ ] **Step 1:** Implementar masks; trocar no form de produto o input monetário do custo por `maskDecimalPrice` (formulário mostra todas as casas) e na listagem `formatDecimalPrice(costPrice, 4)`.
- [ ] **Step 2:** Implementar lookup API + source.
- [ ] **Step 3:** `cd frontend && npx tsc --noEmit` → ok. Na UI: editar produto, custo `3,4566666667` salva e reabre igual; listagem mostra `3,4567`; split mostra `5.300,00`; estoque mínimo aceita `2,5375`.
- [ ] **Step 4:** Commit `feat(products): custo com 10 casas, quantidade com 4 e busca de produto no EntityPicker`.

### Task 5: Entrada — CRUD backend (catálogo, validators, service, controller, rotas)

**Files:** create `goods_entry_validators.ts`, `goods_entry_service.ts` (CRUD/list/serialize), `goods_entries_controller.ts`; modify `catalog.ts`, `start/routes.ts`, `frontend/src/permissions/module-labels.ts`.

**Interfaces — Produces:**
- `GoodsEntryItemDTO = { productId: number; quantity: string; unitPrice: string; discount?: number }`.
- `CreateGoodsEntryDTO` = cabeçalho da spec (`icmsSt`, `ipi`, `freight`, `insurance`, `otherExpenses` opcionais `number`) + `items`.
- `goodsEntryService.list/show/create/update/destroy` — mesma forma do `ServiceEntryService`. `SORT_EXPRESSIONS`: `supplier`, `document_type`, `net_amount` (subquery: `Σ(round(quantity*unit_price, 2) - discount) - discount + icms_st + ipi + freight + insurance + other_expenses`, a **mesma** expressão do select), `status` (CASE do ciclo).
- `serialize(row, items?)` → campos da spec; itens com `quantity`, `unitPrice` **string**, `productDescription`, `productType`, `unitOfMeasure`, `lineTotal` (number reais, de `lineGrossCents − discount`), `stockEffect`. Cabeçalho com `itemsTotal`, `additions`, `netAmount` em reais (`number`).
- `goodsEntryService.netAmountCents(entry, items): bigint` e `itemsTotalCents(items): bigint` — reusadas pelo preview/finalize (Task 6).
- Catálogo: 6 permissões `goods_entries.*` com `name` da spec e `description` pt-BR; label `goods_entries: 'Entradas de mercadoria'`.

Regras no create/update (service): relações do tenant e ativas (mesma política de "vínculo antigo inativo passa" do `assertRelations`); produto repetido → 422 *"O produto {descrição} aparece mais de uma vez na entrada."*; produto `fixed_asset` com qtd não inteira → 422 da spec; `fixed_asset` com qtd > 999 → 422 *"A quantidade máxima para produto ativo é 999."*; desconto do item > bruto → 422; desconto da NF-e > total dos produtos → 422; 1º vencimento < emissão → 422. Exclusão só `open`, com 409 em FK.

- [ ] **Step 1:** Validators (VineJS): strings decimais por regex (`quantity` `^\d{1,11}(\.\d{1,4})?$` e > 0 checado no service; `unitPrice` `^\d{1,10}(\.\d{1,10})?$`); `items` min 1; `status`/`operationDate`/`stockEffect` ausentes.
- [ ] **Step 2:** Service CRUD + controller + rotas (`/goods-entries`, `/:id`) com as permissões. Catálogo + module-label. `node ace db:seed`.
- [ ] **Step 3:** Verificar por script: criar entrada com item `quantity '2.53'`, `unitPrice '3.4567'` → `show` devolve `'2.5300'`/`'3.4567000000'` e `lineTotal 8.75`; `netAmount` com frete 500 e IPI 300 sobre 10.000 → 10.800; produto repetido → 422; ativo qtd `'1.5'` → 422; ativo `'1000'` → 422; listagem ordena por `net_amount` asc/desc coerente com a coluna; editar substitui itens; excluir aberta → 204; excluir um produto, tipo de documento ou tipo de pagamento usado por uma entrada → 409 em pt-BR.
- [ ] **Step 4:** typecheck; commit `feat(goods-entries): CRUD da entrada de mercadoria`.

### Task 6: Efeito em produto, preview, finalizar e cancelar

**Files:** create `goods_entry_stock.ts`; modify `goods_entry_service.ts`, `goods_entries_controller.ts`, `goods_entry_validators.ts`, `start/routes.ts`, `payable_service.ts`, `payable.ts`.

**Interfaces — Produces:**
- `resolveStockEffect(product: Pick<Product, 'type' | 'controlsStock'>): StockEffect` — tabela da spec.
- `goodsEntryStock.apply(tenant, entry, items, trx): Promise<void>` — trava produtos (`forUpdate`, id asc), revalida `fixed_asset` inteiro/≤ 999, aplica saldo (SQL `coalesce(...,0) + ?`), custo (médio para `stock`, último para `none`/`asset`, **pula** quando o custo unitário da entrada é zero), cria ativos (`ProductAsset.createMany` no `trx`, campos da spec), grava `stockEffect` em cada item.
- `goodsEntryStock.assertReversible(tenant, entry, items, trx): Promise<void>` — trava produtos e checa os 3 bloqueios da spec com as mensagens exatas (ativo não disponível; saldo negativo; produto `stock` que não controla mais estoque). Não altera nada.
- `goodsEntryStock.reverse(tenant, entry, items, trx): Promise<void>` — decrementa saldo dos itens `stock`, exclui `product_assets` com `goods_entry_id = entry.id`. Custo intocado.
- `CreatePayableFromSourceDTO.goodsEntryId?: number | null` (gravado em `Payable.goodsEntryId`).
- `goodsEntryService.finalizePreview(tenant, id)` → `{ itemsTotal, discount, additions, netAmount, installments: { installment, amount, dueDate }[], effects: { productId, description, effect: StockEffect, quantity: string, assetsToCreate: number }[] }` (reais `number`, datas ISO). Só `open` (422 caso contrário). Não grava.
- `goodsEntryService.finalize(tenant, id, dueDates: Date[])` e `.cancel(tenant, id)` — passos e validações exatamente como as seções *A transação* e *Cancelar entrada* da spec (mensagens copiadas). `notes` do título: *"Título gerado a partir da entrada de mercadoria: {id} com o tipo de pagamento: {NOME}"*. Baixa automática via `settleFullInTransaction` na data do vencimento.
- Rotas: `GET /goods-entries/:id/finalize-preview` e `POST /goods-entries/:id/finalize` com `goods_entries.finalize`; `POST /goods-entries/:id/cancel` com `goods_entries.cancel`. Validator `finalizeGoodsEntryValidator = { dueDates: vine.array(vine.date()).minLength(1) }`.

- [ ] **Step 1:** `goods_entry_stock.ts` com `resolveStockEffect`, `apply`, `assertReversible`, `reverse`.
- [ ] **Step 2:** Preview, finalize, cancel no service; controller; rotas; `goodsEntryId` no `createFromSource`.
- [ ] **Step 3:** Script de verificação cobrindo os critérios de aceite da spec de finalização/cancelamento, **mais o Review Focus 1, 2, 3 e 5**:
  - rateio 12.500,00 em 3 → `4166.66, 4166.66, 4166.68`; `dueDates` editados (13/11, 20/12, 13/01) gravados; quantidade de datas ≠ N → 422; data < emissão → 422; data < anterior → 422;
  - tipo com `auto_settlement` → títulos `paid`, baixa na data do vencimento;
  - produto estoque 10 @ 3,00 + entrada 10 @ 4,00 → 20 / `3.5000000000`; segunda entrada 20 @ 5,00 → 40 / `4.2500000000` (RF1);
  - item 10 @ 4,00 com desconto 5,00 → custo de entrada `3.5000000000`;
  - produto legado `controls_stock=true`, saldo/custo `null` → saldo = qtd, custo = da entrada (RF5);
  - consumível sem estoque → saldo `null`, custo = último; ativo qtd 3 → 3 `product_assets` `available`, descrição do produto, `asset_code null`, `goods_entry_id`; preço zero → custo inalterado;
  - entrada salva com consumível, produto alterado para `fixed_asset`, item qtd `1.5` → finalize 422 e **nada** persiste (RF2);
  - cancelar a 1ª de duas entradas do mesmo produto → saldo volta só a quantidade dela, custo igual (RF3); títulos `cancelled` sem baixas; ativos excluídos;
  - ativo gerado alocado → cancel 422 com a mensagem; estorno que deixaria saldo negativo (ajustar saldo direto no banco para simular saída) → 422; produto `stock` que passou a não controlar estoque → 422; em todos, nada muda;
  - cancelada → editar/finalizar/cancelar/excluir 422; perfil sem `goods_entries.finalize` → 403 no preview e no finalize.
- [ ] **Step 4:** typecheck; commit `feat(goods-entries): finalização com estoque, custo e ativos, e cancelamento reversível`.

### Task 7: Frontend — API, tipos, listagem, menu e rotas

**Files:** create `goods-entries-api.ts`, `goods-entries-page.tsx`, `goods-entry-status-badge.tsx`; modify `types/api.ts`, `menu.ts`, `router.tsx`.

**Interfaces — Produces:**
- `goodsEntriesApi`: `list(params)`, `get(id)`, `create(payload)`, `update(id, payload)`, `remove(id)`, `finalizePreview(id)`, `finalize(id, dueDates: string[])`, `cancel(id)`.
- Tipos `GoodsEntry`, `GoodsEntryItem` (`quantity`/`unitPrice` string), `GoodsEntryFinalizePreview`, `GoodsEntryPayload`.
- Query keys da spec; finalizar/cancelar invalidam `goods-entries`, `payables`, `products`, `product-assets` da empresa.

- [ ] **Step 1:** Listagem espelhando `service-entries-page.tsx` (filtros, colunas, ordenação, menu Ações por status/permissão, `ConfirmDialog` de excluir e de cancelar com o texto de desfazer títulos/estoque/ativos). "Finalizar entrada" abre o dialog da Task 9 (deixe o gancho).
- [ ] **Step 2:** Menu: grupo **Movimentação** (`ArrowLeftRight`) após **Serviços**, folha "Entrada de mercadoria" (`PackagePlus`, `goods_entries.view`). Router: as 4 rotas em `PermissionRoute`.
- [ ] **Step 3:** `npx tsc --noEmit`; na UI a listagem abre com o filtro de operação do mês, lista as entradas criadas na Task 5/6, ordena por todas as colunas; sidebar com todos os grupos abertos ainda rola até o fim.
- [ ] **Step 4:** Commit `feat(goods-entries): listagem e menu Movimentação`.

### Task 8: Frontend — formulário e seção de produtos

**Files:** create `goods-entry-form-page.tsx`, `goods-entry-items-section.tsx`, `src/lib/decimal.ts`.

**Interfaces — Consumes:** `maskQuantity`/`maskDecimalPrice`/`parseDecimalPrice`/`formatDecimalPrice` (Task 4), `productSource` (Task 4), `goodsEntriesApi` (Task 7).
**Produces:** `lib/decimal.ts`: `lineGrossCents(quantity: string, unitPrice: string): bigint` (mesma regra da Task 1, só para exibição).

- [ ] **Step 1:** Form em rota dedicada com as 4 seções da spec, espelhando `service-entry-form-page.tsx`; `readOnly` em `/goods-entries/:id`.
- [ ] **Step 2:** Seção de produtos: `EntityPicker source="product"`; ao escolher, preço = `costPrice` do lookup (vazio se `null`); produto já na lista → não adiciona e mostra *"Este produto já está na entrada."*; produto ativo com qtd fracionada → erro no campo antes do **+**; tabela Código/Descrição/Un./Qtd./Preço/Desconto/Valor total; rodapé com quantidade de produtos, total dos produtos e total da nota (centavos via `lineGrossCents`).
- [ ] **Step 3:** `npx tsc --noEmit`; na UI (Review Focus 4): digitar `1.234,5678` na qtd e `0,0325` no preço → payload (DevTools) traz `"1234.5678"` e `"0.0325"`; colar `12500` no preço → `"12500"`; item 2,53 × 3,4567 mostra R$ 8,75; editar uma entrada existente reabre os valores com todas as casas.
- [ ] **Step 4:** Commit `feat(goods-entries): formulário da entrada com produtos`.

### Task 9: Frontend — diálogo de finalização com vencimentos editáveis

**Files:** create `finalize-goods-entry-dialog.tsx`; modify `goods-entries-page.tsx`.

- [ ] **Step 1:** Ao abrir, `useQuery` no `finalizePreview`; mostra o resumo (total dos produtos, desconto, ST+IPI, frete/seguro/outras, valor da nota), a tabela de parcelas (ordem, valor, **vencimento editável** por linha) e a lista de efeitos ("gera N ativos", "+X no estoque", "atualiza custo"). Validação local: data ≥ emissão e ≥ anterior, com a mesma mensagem do backend. Confirmar → `finalize(id, dueDates)`; erro 422 exibido no diálogo.
- [ ] **Step 2:** `npx tsc --noEmit`; na UI: finalizar uma entrada alterando a 2ª data → contas a pagar mostra os títulos com essas datas; Produtos mostra o saldo/custo novos; Ativos do produto mostra os ativos gerados; cancelar a entrada desfaz.
- [ ] **Step 3:** Commit `feat(goods-entries): finalização com vencimentos editáveis`.

### Task 10: Fechamento — verificação completa e `state.md`

**Files:** modify `state.md`.

- [ ] **Step 1:** Rodar de novo os scripts das Tasks 3, 5 e 6 do zero → todos `ok`. `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) → limpos.
- [ ] **Step 2:** Percorrer os **critérios de aceite** da spec, um a um, marcando onde cada um foi verificado; qualquer um sem verificação vira verificação agora.
- [ ] **Step 3:** `state.md`: tabelas `goods_entries`/`goods_entry_items`, colunas novas/ampliadas, módulo entregue, rotas backend/frontend, grupo de menu Movimentação, convenção de decimais como string na API, data do snapshot.
- [ ] **Step 4:** Commit `docs(state): entrada de mercadoria`.

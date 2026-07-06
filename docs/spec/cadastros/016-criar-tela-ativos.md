# Spec: Criar tela de ativos (filha de produtos)

Cadastro **pai-filho** — um ativo (imobilizado) pertence a um **produto**.
Espelha o padrão de `brand_models` (filho de `brands`), mas com mais campos e
um par **marca → modelo em cascata** (reusa `brands` e `brand_models`).

## Domínio
- Entidade: **ativo** (masculino), filho de um produto.
- Regra central: **apenas produtos do tipo `fixed_asset`** (ativo imobilizado)
  permitem cadastrar ativos. Produtos `consumable` não expõem a tela nem
  aceitam ativos (reforçado no backend, não só na UI).
- Exemplos: cada unidade física de um equipamento (ex.: os N aparelhos de
  ar-condicionado que a empresa possui de um mesmo produto/modelo).
- Justificativa de negócio: controlar patrimônio/imobilizado item a item
  (código de patrimônio, situação, localização futura).

## Específicos do módulo
- Tabela: `product_assets`:
  - `id`
  - `company_id` FK `companies` `RESTRICT` — **denormalizado** (blindagem
    cross-tenant + queries escopadas simples).
  - `product_id` FK `products` `RESTRICT` — autoridade do pai, vem do path.
  - `description varchar(160)` **NOT NULL**.
  - `asset_code varchar(60)` NULL — cód. patrimônio. **Sem unicidade.**
  - `brand_id` FK `brands` `RESTRICT` NULL.
  - `brand_model_id` FK `brand_models` `RESTRICT` NULL — em cascata com `brand_id`.
  - `manufacture_year varchar(4)` NULL — ano de fabricação (string).
  - `btu varchar(20)` NULL.
  - `situation varchar` **NOT NULL** default `available` — enum
    `available` (Disponível) / `allocated` (Alocado) / `sold` (Vendido).
  - `equipment_exists boolean` **NOT NULL** default `false`.
  - `notes text` NULL — observação.
  - timestamps.
  - Índice `(product_id, description)`.
- Slug do módulo: `product_assets` (permissões `product_assets.view/create/edit/delete`).
- Endpoints (aninhados sob o produto):
  `GET|POST /api/products/:productId/assets`,
  `GET|PUT|DELETE /api/products/:productId/assets/:id`.
  O `productId` vem **sempre do path** — o cliente não injeta o pai pelo body.
- Rota frontend: `/products/:productId/assets` (gated `product_assets.view`).
  **Sem item de menu.**
- Módulo frontend: `src/modules/product-assets/`.
- Acesso: botão ícone `HardDrive` (lucide-react) em cada linha da tela de
  Produtos **apenas quando `type === 'fixed_asset'`** (gated `product_assets.view`),
  que navega para `/products/:productId/assets`.

## Dependência de permissão
O formulário reusa a listagem de marcas e a cascata de modelos. Portanto roles
com `product_assets.*` também precisam de **`brands.view`** e
**`brand_models.view`** — mesma decisão já adotada em Produtos (subgrupos).
Documentado no `catalog.ts`.

## Critérios de aceite
- Backend valida que o produto pai existe no tenant ativo **e** é
  `fixed_asset`:
  - inexistente/cross-tenant → 404 neutro *"Produto não encontrado."*;
  - existe mas é `consumable` → 422 *"Este produto não permite ativos."*.
- Toda query escopada por `company_id` + `product_id`.
- `situation` validada contra o enum (422 se inválida); default `available` no create.
- `brand_id`/`brand_model_id`, quando enviados, validados como pertencentes ao
  tenant, e o modelo validado como pertencente à marca escolhida
  (422 com mensagem específica).
- Hard delete (é folha; sem 409 esperado — mas trata FK violation por robustez).
- Página drill-down: header "Ativos de {produto}", link voltar "← Produtos",
  valida o pai, filtros (cód. patrimônio, descrição debounced, situação),
  paginação 20/página, colunas ordenáveis, modal de create/edit `max-w-2xl`.
- Form (modal): Descrição, Cód. patrimônio, Marca (só ativas + mantém a atual no
  edit), Modelo (`Select` em cascata pela marca; reusa
  `GET /brands/:brandId/models`), Ano de fabricação, BTU, Situação (`Select`),
  Equipamento existe (checkbox), Observação (`textarea`).

# Estado da aplicação — MPM Web

**Snapshot**: 2026-07-06
**Para que serve**: registro do estado atual do projeto, lido por sessões
futuras (Claude ou desenvolvedor) para se orientarem sem reler todo o
código. Atualize este arquivo quando:

- Uma nova feature/módulo for entregue
- Schema do banco mudar (migration aplicada)
- Endpoints da API forem adicionados/removidos
- Decisões de arquitetura mudarem

Para convenções e arquitetura, ver [`CLAUDE.md`](CLAUDE.md) (raiz),
[`backend/CLAUDE.md`](backend/CLAUDE.md) e [`frontend/CLAUDE.md`](frontend/CLAUDE.md).

## Stack

- **Backend**: AdonisJS 6 (LTS) + TypeScript + PostgreSQL + JWT, com
  `@adonisjs/drive` (disk `fs` em dev) para uploads.
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS v4 + shadcn/ui,
  TanStack Query, React Hook Form + Zod, react-router-dom.
- **Banco**: PostgreSQL local (sem Docker). Em prod: `DATABASE_URL`.

## Esquema do banco (20 tabelas)

| Tabela | Resumo |
| --- | --- |
| `companies` | Tenants. Soft delete. Identificação + IE/IM + endereço + contato + logo. |
| `roles` | Perfis. ROOT é o único global (`company_id NULL`, `is_system=true`, inviolável); todos os demais são por empresa, criados pelo cliente. Tem `is_active` para desativar sem excluir. Unique `(company_id, slug)`. |
| `permissions` | Catálogo de slugs `<module>.<action>`. |
| `users` | Usuários da plataforma. Senha hasheada. Soft delete. `is_root` libera curinga `*`. |
| `memberships` | Vínculo `user × company` com `role` + `extra_permissions`. Soft delete. |
| `role_permissions` | Permissões padrão por role. |
| `membership_permissions` | Permissões extras por vínculo. |
| `payment_types` | Tipos de pagamento por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. `auto_settlement` (bool, **NOT NULL** default `false`) — realiza baixa automática de título. |
| `document_types` | Tipos de documento por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `units_of_measure` | Unidades de medida por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `service_groups` | Grupos de serviço por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `product_groups` | Grupos de produto por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `product_subgroups` | Subgrupos de produto, filhos de `product_groups`. **Hard delete**. FKs `company_id` e `product_group_id` ambas com `RESTRICT`. Multitenant. |
| `suppliers` | Fornecedores por empresa. Campos: `tax_id` (CPF/CNPJ cru), `name`, `type` (`goods`/`service`), endereço, telefones, contato, `is_active`. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. Sem unicidade de `tax_id`. |
| `customers` | Clientes por empresa (PF/PJ). Campos: `type` (`individual`/`company`), `legal_name`, `trade_name` (PJ), `tax_id` cru, endereço (com `address_number` e `address_complement`), telefones, `email`, `customer_since`, `contact_name`, `is_active`, `is_internal` (flag de cliente interno da oficina). **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. Sem unicidade. |
| `services` | Serviços por empresa. Campos: `service_group_id` (FK `service_groups`), `description`, `suggested_value` (`decimal(12,2)`, em reais, nullable), `type` (`internal`/`third_party`), `notes` (text), `is_active`. **Hard delete**. FKs `company_id` e `service_group_id` ambas com `RESTRICT`. `company_id` denormalizado. Multitenant. Sem unicidade. |
| `products` | Produtos por empresa. Campos: `description`, `type` (`consumable`/`fixed_asset`, **NOT NULL**), `product_group_id`/`product_subgroup_id`/`unit_of_measure_id` (FKs **opcionais**), `controls_stock` (bool), `minimum_stock`/`quantity_in_stock` (`decimal(12,3)`, nullable), `cost_price` (`decimal(12,2)`, reais, nullable), `is_active`. Só `description` é obrigatório. **Hard delete** (409 em uso). Todas as FKs com `RESTRICT`. Multitenant. Sem unicidade. `controls_stock` governa os campos de estoque (off → ambos `null`); `quantity_in_stock` imutável após o create. |
| `brands` | Marcas por empresa. Campos: `description`, `is_active`. **Hard delete** (409 em uso). FK `company_id` com `RESTRICT`. Multitenant. Sem unicidade. |
| `brand_models` | Modelos por marca (filho de `brands`). Campos: `description`, `is_active`. `company_id` denormalizado + FK `brand_id` (autoridade do pai), ambos `RESTRICT`. **Hard delete** (409 em uso). Multitenant. Sem unicidade. Índice `(brand_id, description)`. |
| `product_assets` | Ativos/imobilizado por produto (filho de `products`; só produtos `fixed_asset`). Campos: `description` (**NOT NULL**), `asset_code` (cód. patrimônio, null, **sem unicidade**), `brand_id`/`brand_model_id` (FKs opcionais, modelo em cascata da marca), `manufacture_year` (varchar 4), `btu` (varchar 20), `situation` (`available`/`allocated`/`sold`, **NOT NULL** default `available`), `equipment_exists` (bool, **NOT NULL** default `false`), `notes` (text). `company_id` denormalizado + FK `product_id` (autoridade do pai), ambos `RESTRICT`; `brand_id`/`brand_model_id` também `RESTRICT`. **Hard delete**. Multitenant. Índice `(product_id, description)`. |

Colunas atuais de `companies` (após migration `1779413112478`):
`id, legal_name, trade_name, tax_id, state_registration, municipal_registration,
address, address_number, neighborhood, city, zip_code (char 8), state (char 2),
phone, email, logo_path, slug, is_active, created_at, updated_at, deleted_at`.

## Módulos entregues

- **Auth** — login, refresh, logout, forgot/reset password (token JWT stateless de 30 min para reset).
- **Multitenant** — header `x-company-id` define empresa ativa; `TenantContext` aplica permissões + escopo de dados.
- **RBAC** — catálogo em `backend/app/abilities/catalog.ts`. Slugs `dashboard.*`, `companies.*`, `users.*`, `permissions.*`, `roles.*`, `products.*`, `product_assets.*`, `brands.*`, `brand_models.*`, entre outros. ROOT bypassa tudo. ADMIN/OPERADOR não existem mais como perfis seedados — cada empresa cria os seus.
- **Dashboard** — contagens (usuários, empresas, roles, permissions).
- **Users (CRUD)** — listagem paginada, modal de form, papel + permissões extras.
- **Companies (CRUD)** — listagem paginada com avatar de logo; formulário em **rota dedicada** (`/companies/new` e `/companies/:id/edit`) com seções Identificação, Endereço, Contato, Logomarca. Upload de logo via multipart único, atomicidade no create (rollback se upload falhar).
- **Permissions** — visualização do catálogo e edição por role.
- **Perfis (CRUD)** — perfis (roles) por empresa, com formulário em **rota dedicada** (`/roles`, `/roles/new`, `/roles/:id/edit`) e seletor de permissões agrupadas por módulo. ROOT é invisível à UI. Ver [spec 007](docs/spec/cadastros/007-criar-tela-perfil.md).
- **Payment Types (CRUD)** — primeiro CRUD do padrão "simples" (descrição + status, multitenant, hard delete, modal). Aplicação canônica da rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Tipos de documento (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Unidades de medida (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Grupos de serviço (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Grupos de produto (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md). Linha do parent tem botão `Layers` que abre os subgrupos.
- **Subgrupos de produto (CRUD aninhado)** — Filhos de `product_groups`, acesso por drill-down (`/product-groups/:groupId/subgroups`), não entra no menu. Permissões separadas `product_subgroups.*`. Mesma UX da simple-CRUD escopada por pai. Ver [spec 006](docs/spec/cadastros/006-criar-tela-subgrupo-de-produto.md).
- **Fornecedores (CRUD)** — Cadastro mestre por empresa com 11 campos + status. Formulário em modal `max-w-2xl` em 3 seções (Identificação, Endereço, Contato). Validação de CPF/CNPJ com checksum no backend (`#utils/tax_id`) e mirror no frontend (`lib/tax-id.ts`). Listagem com filtros (nome, CPF/CNPJ, tipo, status), paginação, colunas ordenáveis. Hard delete. Ver [spec 010](docs/spec/cadastros/010-criar-tela-fornecedores.md).
- **Clientes (CRUD)** — Cadastro mestre PF/PJ por empresa com 17 campos. Formulário em modal `max-w-3xl` em 4 seções (Identificação, Endereço, Contato, Dados do cliente). Validação cruzada tipo↔tax_id (PF=11 dígitos+CPF, PJ=14+CNPJ) com mensagens específicas. Label de "Razão social"/"Nome completo" e visibilidade de "Nome fantasia" reagem ao tipo. Filtros: nome (busca em razão social **e** nome fantasia), CPF/CNPJ, tipo, status (default *Ativos*). Inclui `customer_since` (default = hoje no create) e flag `is_internal`. Hard delete. Ver [spec 011](docs/spec/cadastros/011-criar-tela-clientes.md).
- **Produtos (CRUD)** — Cadastro mestre por empresa. `description` e `type` obrigatórios; grupo/subgrupo/unidade são FKs opcionais. Subgrupo em **cascata** com o grupo (reusa `GET /product-groups/:groupId/subgroups`, que exige `product_subgroups.view` — decisão "C": roles com `products.*` precisam dessa permissão). `controls_stock` governa estoque mínimo/quantidade (off → ambos `null` e desabilitados no form). Tipo **ativo imobilizado** força `controls_stock=false` (toggle travado, campos de estoque desabilitados) — reforçado no backend. `quantity_in_stock` só no create (imutável no edit, estratégia A — validator de update sem o campo); com controle ligado e sem valor nasce `0`. Filtros: descrição, grupo, tipo, controla estoque, status (default *Ativos*) + checkbox **estoque baixo** (`controls_stock && minimum_stock != null && qty <= min`). Máscaras pt-BR: `maskQuantity`/`parseDecimal`/`formatQuantity` em `lib/masks.ts`; novo primitivo `ui/checkbox.tsx`. Hard delete. Ver [spec 013](docs/spec/cadastros/013-criar-tela-produtos.md).
- **Serviços (CRUD)** — Cadastro mestre por empresa, vinculado a um grupo de serviço (FK). Formulário em modal `max-w-2xl`: descrição, grupo (`Select` só com grupos ativos; no edit mantém o grupo atual mesmo se inativo), tipo (`internal`/`third_party`), valor sugerido (input de moeda BRL, opcional), observações (`textarea`), status. Valor armazenado em `decimal(12,2)` (reais); helpers `maskMoney`/`formatCurrency` em `lib/masks.ts`; novo primitivo `ui/textarea.tsx`. Filtros: descrição + tipo (sem filtro de status). Coluna "Grupo" exibida (não ordenável). Backend valida que o grupo pertence ao tenant (422 *"Grupo de serviço inválido."*). Hard delete (409 em uso). Ver [spec 012](docs/spec/cadastros/012-criar-tela-servicos.md).
- **Marcas (CRUD)** — CRUD simples padrão. Ver rule [simple-crud-pattern](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md) e [spec 014](docs/spec/cadastros/014-criar-tela-marca.md).
- **Modelos (CRUD, filho de marcas)** — Cadastro pai-filho: modelo pertence a uma marca. Espelha `product_subgroups`. Rotas aninhadas `/api/brands/:brandId/models`; `brandId` vem do path, service com `ensureParent` (404 neutro "Marca não encontrada."). Página drill-down `/brands/:brandId/models` (gated `brand_models.view`, **sem menu**), acessada por botão ícone `Shapes` em cada linha de Marcas. Campos descrição + status (masculino: Ativo/Inativo). Hard delete (409 em uso). Ver [spec 015](docs/spec/cadastros/015-criar-tela-modelos.md).
- **Ativos (CRUD, filho de produtos)** — Cadastro pai-filho: um ativo/imobilizado pertence a um produto, e **só produtos `fixed_asset`** permitem ativos. Rotas aninhadas `/api/products/:productId/assets`; `productId` vem do path, service com `ensureParent` (404 neutro "Produto não encontrado."; 422 *"Este produto não permite ativos."* quando o produto é `consumable`). Página drill-down `/products/:productId/assets` (gated `product_assets.view`, **sem menu**), acessada por botão ícone `HardDrive` que **só aparece em linhas de produto `fixed_asset`** na tela de Produtos. Campos: descrição (obrigatória), cód. patrimônio, marca + modelo (FKs opcionais, **modelo em cascata** da marca — reusa `GET /brands/:brandId/models`), ano de fabricação, BTU, situação (Disponível/Alocado/Vendido, default Disponível), equipamento existe (checkbox), observação. Filtros: cód. patrimônio, descrição, situação. Form modal `max-w-2xl`. **Dependência de permissão**: roles com `product_assets.*` precisam também de `brands.view` + `brand_models.view` (mesma decisão de Produtos/subgrupos). Hard delete. Ver [spec 016](docs/spec/cadastros/016-criar-tela-ativos.md).

## Rotas

### Backend (`/api`)

Públicas: `POST /auth/{login,refresh,forgot-password,reset-password}`.
Autenticadas: `GET /auth/me`, `POST /auth/logout`.
Autenticadas + empresa ativa (cada uma com gate de permissão):
- `GET /me/context`
- `GET /dashboard`
- `GET|POST /users`, `GET|PUT|DELETE /users/:id`
- `GET|POST /companies`, `GET|PUT|DELETE /companies/:id` *(POST/PUT aceitam multipart com `logo` + `removeLogo`)*
- `GET /permissions`
- `GET|POST /roles`, `GET /roles/options`, `GET|PUT|DELETE /roles/:id`
- `GET|POST /payment-types`, `GET|PUT|DELETE /payment-types/:id`
- `GET|POST /document-types`, `GET|PUT|DELETE /document-types/:id`
- `GET|POST /units-of-measure`, `GET|PUT|DELETE /units-of-measure/:id`
- `GET|POST /service-groups`, `GET|PUT|DELETE /service-groups/:id`
- `GET|POST /product-groups`, `GET|PUT|DELETE /product-groups/:id`
- `GET|POST /product-groups/:groupId/subgroups`, `GET|PUT|DELETE /product-groups/:groupId/subgroups/:id`
- `GET|POST /suppliers`, `GET|PUT|DELETE /suppliers/:id`
- `GET|POST /customers`, `GET|PUT|DELETE /customers/:id`
- `GET|POST /services`, `GET|PUT|DELETE /services/:id`
- `GET|POST /products`, `GET|PUT|DELETE /products/:id`
- `GET|POST /products/:productId/assets`, `GET|PUT|DELETE /products/:productId/assets/:id`
- `GET|POST /brands`, `GET|PUT|DELETE /brands/:id`
- `GET|POST /brands/:brandId/models`, `GET|PUT|DELETE /brands/:brandId/models/:id`

Estáticas: `GET /uploads/*` (servidas pelo `@adonisjs/drive`, disk `fs` em
`backend/storage/uploads/`).

### Frontend

Públicas: `/login`, `/forgot-password`, `/reset-password`.
Autenticadas: `/select-company`.
Protegidas (em `AppLayout`): `/` (dashboard), `/users`, `/companies`,
`/companies/new`, `/companies/:id/edit`, `/roles`, `/roles/new`,
`/roles/:id/edit`, `/permissions`, `/payment-types`, `/document-types`,
`/units-of-measure`, `/service-groups`, `/product-groups`,
`/product-groups/:groupId/subgroups` *(drill-down — não está no menu)*,
`/suppliers`, `/customers`, `/services`, `/products`,
`/products/:productId/assets` *(drill-down — não está no menu)*, `/brands`,
`/brands/:brandId/models` *(drill-down — não está no menu)*.

## Convenções importantes

- **Idioma**: código (tabelas, colunas, models, rotas, JSON da API) em inglês; textos visíveis ao usuário e mensagens de erro da API em português.
- **Multitenant**: toda `queryKey` no frontend inclui `tenant.companyId`. Toda query de negócio no backend é filtrada por `tenant.company.id` (exceto ROOT).
- **Máscaras**: CPF/CNPJ/CEP/telefone armazenados crus no banco; mascarados só na UI (`frontend/src/lib/masks.ts` + `MaskedInput`).
- **Soft delete**: setar `deleted_at`; repositories filtram com `whereNull`.
- **Camadas backend**: HTTP → Middleware → Controller → Service → Repository → Model. Controllers finos, services com a lógica.

## Storage de arquivos

- Em dev: `backend/storage/uploads/<key>` servido em `/uploads/<key>` via Drive.
- DB salva o caminho relativo (ex.: `/uploads/logos/abc-123.png`).
- Frontend resolve com `resolveAssetUrl()` em [`frontend/src/services/api-client.ts`](frontend/src/services/api-client.ts) (prepende o host da API).
- Em prod: trocar o disk `fs` para `s3`/`r2` em `config/drive.ts`.

## Usuário inicial (seed)

`carlossantana.desenv@gmail.com` / `12345678` — ROOT, com a empresa demo. Criado por `backend/database/seeders/main_seeder.ts` (idempotente).

## Decisões conscientes (NÃO usar)

Microserviços, filas, websocket, jobs em background, Kubernetes,
event-driven, CQRS, DDD complexo. Princípio: simplicidade, produtividade,
manutenção fácil, segurança e segregação de dados. ~15 usuários internos
no uso inicial.

## Onde encontrar mais

- Arquitetura geral: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Specs de features: [`docs/superpowers/specs/`](docs/superpowers/specs/) e [`docs/spec/`](docs/spec/).
- Regras de UI do projeto: [`frontend/.agents/skills/mpmweb-ui-patterns/`](frontend/.agents/skills/mpmweb-ui-patterns/).

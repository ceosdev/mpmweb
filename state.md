# Estado da aplicação — MPM Web

**Snapshot**: 2026-08-16
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

## Esquema do banco (28 tabelas)

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
| `payables` | Títulos a pagar por empresa (financeiro). Campos: `document_number` (**varchar(20)**, não number — preserva zeros à esquerda e aceita "12345/A"), `installment` (ordem/parcela, 1–999, default 1), `supplier_id` (FK, o "cedente"), `issue_date`/`due_date` (`date`), `amount`/`discount`/`fine`/`interest` (`decimal(12,2)`, reais), `notes`. **Campos de resultado, nunca escritos pelo usuário**: `paid_amount` (`decimal(12,2)` default 0 — quem move é o futuro módulo de baixa) e `status` (`open`/`partially_paid`/`paid`/`cancelled`, default `open`, **derivado** de `paid_amount`). `service_entry_id` (FK `service_entries`, **nullable**, `RESTRICT`) — a **origem** do título: preenchida quando ele nasceu da finalização de uma [entrada de serviço](docs/spec/servicos/001-criar-tela-entrada-de-servico.md), `null` quando nasceu solto (botão "Novo"). Nullable de propósito e preparada para conviver com o *lançamento direto financeiro* que virá: **uma coluna por origem**, cada uma opcional, em vez de um par polimórfico `origin_type`/`origin_id` — mais simples de ler, indexar e consultar. `RESTRICT` é o banco, não a aplicação, barrando excluir uma entrada que já gerou título. **Sem unicidade** — duplicar título é permitido (decisão explícita). **Hard delete**. FKs `company_id`, `supplier_id` e `service_entry_id` com `RESTRICT`. Multitenant. Índices `(company_id, due_date)`, `(company_id, status)`, `(company_id, supplier_id)`, `(service_entry_id)`. `paid_amount`/`status` agora são movidos pelo módulo de **baixa** (`payable_settlements`) ou, quando a entrada de serviço tem tipo de pagamento com `auto_settlement`, pela própria finalização. |
| `payable_settlements` | Baixas (pagamentos) de um título — filhas de `payables`. Campos: `payable_id` (FK), `payment_type_id` (FK), `settlement_date` (`date`), `amount` (`decimal(12,2)`, reais), `document_number` (varchar(30) nullable, "apenas para cheque"), `notes`. **Hard delete**. As 3 FKs (`company_id`, `payable_id`, `payment_type_id`) com `RESTRICT` — é o `payable_id RESTRICT` que barra excluir título com baixa (409). Índice `(company_id, payable_id)`. A soma das baixas = `payables.paid_amount` (recalculada do zero a cada escrita, nunca incrementada) e **nunca excede o total**. Toda escrita roda em **transação** com `forUpdate()` no título. Ver [spec financeiro 002](docs/spec/financeiro/002-baixa-de-titulo.md). |
| `receivables` | Títulos a receber por empresa — **espelho de `payables`**, com FK `customer_id` (o cliente) no lugar de `supplier_id`. Mesmos campos, índices (`(company_id, due_date)`, `(company_id, status)`, `(company_id, customer_id)`), derivação de `status`/`paid_amount` e hard delete. Ver [spec financeiro 004](docs/spec/financeiro/004-contas-a-receber.md). |
| `receivable_settlements` | Baixas (recebimentos) de um título a receber — **espelho de `payable_settlements`**. FK `receivable_id` (RESTRICT, barra excluir título com baixa). Índice `(company_id, receivable_id)`. Mesma mecânica transacional. Ver [spec financeiro 004](docs/spec/financeiro/004-contas-a-receber.md). |
| `expense_groups` | Grupos de despesa por empresa (descrição + status). Hard delete, multitenant. |
| `ldf_parameters` | Parametrizações de LDF (lançamento direto financeiro) por empresa. Campos: `description` (varchar(120), **sem unicidade**), `expense_group_id` (FK `expense_groups`, **NOT NULL**, RESTRICT — barra excluir grupo já parametrizado), `is_active`. O `id` é o "Código" exibido na UI (não há coluna `code`). Hard delete, multitenant. Índices `(company_id, description)` e `(company_id, expense_group_id)`. |
| `service_entries` | Cabeçalho da nota fiscal de serviço recebida de um fornecedor (módulo **Serviços**). FKs `company_id`, `document_type_id`, `supplier_id`, `payment_type_id` — as quatro `RESTRICT`. Campos do documento: `document_number` (varchar(20), mesma decisão de `payables`), `series`/`sub_series` (nullable), `issue_date` (data do documento), `operation_date` (data do lançamento no sistema, `todayIso()`, **não editável**). `discount` é o desconto geral da nota (distinto do desconto por item). `tax_withholding` (`issuer`\|`recipient`, default `issuer`) mais 6 colunas de imposto (`iss`, `pis`, `cofins`, `inss`, `irrf`, `csll`) — zeradas no backend quando `issuer`, a UI não é a única barreira. `payment_type_id` carrega o `auto_settlement`; `installment_count` (quantidade, ≥ 1) e `first_due_date` fecham a condição de pagamento. **Resultados, nunca escritos pelo usuário**: `status` (`open`\|`finalized`\|`cancelled`, default `open`) e `finalized_at` — só mudam pelas ações Finalizar e Cancelar; `cancelled` é terminal, não existe reabertura. **Sem `deleted_at`**: hard delete, e **só quando `status = 'open'`** (uma vez finalizada, o `RESTRICT` de `payables.service_entry_id` barraria de qualquer forma). Sem unicidade de `document_number`. Índices `(company_id, operation_date)`, `(company_id, status)`, `(company_id, supplier_id)`. Ver [spec 001](docs/spec/servicos/001-criar-tela-entrada-de-servico.md). |
| `service_entry_items` | Os serviços descritos na nota — filhos de `service_entries`, sem tela nem permissão próprias (vivem dentro do form do pai). FKs `company_id`, `service_entry_id`, `service_id`, todas `RESTRICT` (`service_entry_id` é `RESTRICT` e não `CASCADE` — o service apaga os itens explicitamente dentro da transação, mesmo padrão do resto do projeto). Campos: `quantity` **inteiro** (serviço se conta por unidade, decisão do usuário, diferente de `products.quantity_in_stock` que é decimal), `unit_price` (`decimal(12,2)`), `discount` (do item, distinto do desconto da nota). O total da linha (`quantity × unit_price − discount`) é **derivado, nunca gravado** — mesma política do `total` de `payables`. No update do pai, os itens são **substituídos em bloco**: a transação apaga todos e reinsere os do payload, sem diff de item novo/alterado/removido. |

Colunas atuais de `companies` (após migration `1779413112478`):
`id, legal_name, trade_name, tax_id, state_registration, municipal_registration,
address, address_number, neighborhood, city, zip_code (char 8), state (char 2),
phone, email, logo_path, slug, is_active, created_at, updated_at, deleted_at`.

## Módulos entregues

- **Auth** — login, refresh, logout, forgot/reset password (token JWT stateless de 30 min para reset).
- **Multitenant** — header `x-company-id` define empresa ativa; `TenantContext` aplica permissões + escopo de dados.
- **RBAC** — catálogo em `backend/app/abilities/catalog.ts`. Slugs `dashboard.*`, `companies.*`, `users.*`, `permissions.*`, `roles.*`, `products.*`, `product_assets.*`, `brands.*`, `brand_models.*`, `payables.*` (inclui `cancel`), `payable_settlements.*` (inclui `batch` — pagamento em lote), `receivables.*` (inclui `cancel`), `receivable_settlements.*` (inclui `batch` — recebimento em lote), `service_entries.*` (inclui `finalize` e `cancel` como permissões **próprias**, separadas de `edit` — um perfil com `edit` mas sem `finalize` não vê a ação nem passa no gate do endpoint, e vice-versa), entre outros. ROOT bypassa tudo. ADMIN/OPERADOR não existem mais como perfis seedados — cada empresa cria os seus.
  - **Toda permissão nova exige DOIS arquivos**: `catalog.ts` (backend) **e** `frontend/src/permissions/module-labels.ts` (rótulo pt-BR do módulo). Sem o segundo, as telas de Permissões/Perfis/Usuários exibem o slug cru em inglês. Tela filha nomeia o pai no rótulo (`Ativos do produto`, `Modelos da marca`).
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
- **EntityPicker (componente compartilhado)** — Campo de busca para entidades com **muitos registros** (fornecedor, cliente, …), onde o `Select` de `perPage: 200` não serve. O usuário digita (debounce 350 ms, mín. 2 caracteres), a busca roda **no servidor** e o item escolhido vira um **chip com ×**. O valor do campo é **sempre a FK**; o componente **hidrata o rótulo sozinho** (`?ids=`), então nenhuma tela precisa preparar preload. Suporta seleção múltipla (opt-in; default single). **Desacoplado**: conhece só o contrato `EntitySource` + registry em `components/common/entity-picker/entity-sources.ts` — hoje `supplier` e `customer`; acrescentar entidade nova é 1 arquivo + 1 linha. Usar `EntityPicker` ou `Select` continua sendo decisão de cada tela. Endpoints `GET /api/<entidade>/lookup` (`q` = busca por nome **ou** CPF/CNPJ; `ids` = hidratação) protegidos por **auth + tenant, sem a permissão do cadastro** — quem alcança a tela precisa buscar mesmo sem `suppliers.view`; por isso o payload é mínimo (id, nome, documento, status). Busca só ativos; a hidratação traz o inativo (sufixo `(inativo)`), para vínculo antigo não sumir. Primitivos novos: `ui/command.tsx` (dep `cmdk`) e `ui/popover.tsx`. Ver [spec comum 001](docs/spec/comum/001-componente-entity-picker.md).
- **Contas a pagar (CRUD)** — Primeira tela do módulo **Financeiro** (grupo de menu novo) e primeira consumidora do EntityPicker. Título com número (texto), ordem/parcela, cedente (fornecedor via EntityPicker), emissão e vencimento (default hoje), valor + desconto + multa + juros (moeda BRL), observação. **`status` é resultado, não escolha**: derivado de `paid_amount` por `PayableService.recomputeStatus()` — **único ponto de escrita** — e o validator nem aceita o campo (payload com `status` é descartado). Neste CRUD todo título nasce e permanece `open`; *pago*/*parcial* virão da **baixa** e *cancelado* da ação de **cancelar** (ambas em specs seguintes). Editar valores de um título já baixado **recalcula o status** (pago cujo valor sobe volta a parcial); saldo nunca negativo; cancelado é terminal (edição → 422). Derivados devolvidos pela API: `total = amount - discount + fine + interest`, `balance = max(0, total - paid_amount)` (0 se cancelado) e `isOverdue`. **"Vencido" é virtual** (`due_date < hoje` **e** ainda devendo, comparação estrita) — mesma regra no filtro e no **vermelho** da coluna Vencimento; "hoje" é calculado **no backend, no fuso da aplicação** (o servidor roda com `TZ=UTC`, ver `#utils/dates`). Coluna **Valor** exibe o `total` e **ordena pela mesma expressão** (`sort=total`), senão a coluna se contradiria. Filtros: número (contém), cedente (EntityPicker), **2 intervalos de data com checkbox** (vencimento **marcado por default**, do 1º ao último dia do mês corrente; emissão desmarcado) e **status de múltipla escolha** (nenhum = todos; combinam em OR). "Limpar filtros" volta ao **default**, não ao vazio. Hard delete. Ver [spec financeiro 001](docs/spec/financeiro/001-criar-tela-contas-a-pagar.md).
- **Baixa de título / Pagamentos (CRUD, filho de contas a pagar)** — Registra os **pagamentos** (baixas) de um título; é quem move `paid_amount` e leva o título de *Aberto* → *Parcial* → *Pago*. Aberta pelo menu **"Ações"** do grid de contas a pagar (`DropdownMenu`: Editar / **Pagamentos** / Excluir — substituiu os ícones soltos). **Modal drill-down** (sem rota/menu) que abre na **listagem** e troca para o formulário em "Nova baixa" (mesma janela, sem empilhar). Campos: data da baixa (default hoje), tipo de pagamento (FK, `Select` só de ativos), nº documento (opcional, "apenas para cheque"), valor pago (default = **saldo restante**), observação. Regras: **baixa manual** (interação humana — `auto_settlement` não é acionado aqui); a soma das baixas **nunca excede o total** (senão 422 com o saldo disponível); recálculo do `paid_amount`/`status` a cada create/edit/delete; várias baixas no mesmo dia OK; título cancelado não recebe baixa (422); excluir título com baixa → **409**. **Toda escrita é transacional** (`db.transaction` + `forUpdate()` no título) — `PayableService.applySettlement()` valida e recalcula, `recomputeStatus()` continua sendo o único dono do status. Verificado E2E (15 asserções). Ver [spec financeiro 002](docs/spec/financeiro/002-baixa-de-titulo.md).
- **Pagamento em lote (modo na tela de contas a pagar)** — Botão **"Pagamento em lote"** (gated `payable_settlements.batch`, permissão nova; desabilitado se a página não tem título que ainda deve) liga a **multisseleção** do grid: coluna de checkbox só nas linhas **Aberto/Parcial**, "selecionar todos da página", highlight por token e barra de seleção com "Sair do modo lote" + "Pagar N em lote". O modal (`batch-payment-dialog.tsx`) tem só um `Select` de forma de pagamento (ativos) e o aviso em destaque; confirma → `POST /api/payables/batch-settlements` `{ payableIds, paymentTypeId }`. O backend (`PayableSettlementService.batchCreate`) roda **tudo numa transação** (`forUpdate` por título, ordem crescente de id): cada título é baixado pelo **saldo restante** (Aberto=total, Parcial=o que falta) na **data de hoje**, reusando `applySettlement`/`recomputeStatus`. **Atômico** — se algum id não for elegível no submit (não é do tenant, pago/cancelado antes) → 422 nomeando o título + rollback total. Cliente não envia valor nem data (derivados do título travado). O modo lote **desliga** ao paginar (com aviso se há seleção), pesquisar, ordenar, limpar filtros ou trocar de empresa. Ver [spec financeiro 003](docs/spec/financeiro/003-pagamento-em-lote.md).
- **Visualizar título (ação no grid de contas a pagar)** — Item **"Visualizar"** no menu Ações (gated por `payables.view`, a mesma permissão de acesso à tela — logo, disponível a todos que alcançam o grid). Reusa o **mesmo** `PayableFormDialog` com a prop nova `readOnly`: título "Visualizar título", todos os campos desabilitados (Inputs, EntityPicker, MaskedInput, Textarea) e rodapé só com "Fechar" (sem submit). Nenhuma alteração é possível.
- **Contas a receber (módulo completo)** — **Espelho de contas a pagar**, com o vínculo no **cliente** (`customer_id`) em vez do fornecedor. Reimplementa por inteiro: CRUD do título (cliente via EntityPicker `source="customer"`, `ReceivableFormDialog` com `readOnly` para Visualizar), baixa/recebimentos (`ReceivableSettlementsDialog`), cancelar título, recebimento em lote (`BatchReceiptDialog`, gate `receivable_settlements.batch`) e as ações Visualizar/Editar/Excluir. Mesmas regras (status derivado por `ReceivableService.recomputeStatus()`, soma das baixas ≤ total, transações com `forUpdate`, "vencido" virtual, hard delete, multitenant). Vocabulário de tela adaptado: *Cliente* (não Cedente), status *Recebido*/*Recebido parcial*, ação *Recebimentos*, *Recebimento em lote*. Menu **Financeiro → Contas a receber** (`/receivables`, ícone `HandCoins`). Módulo frontend `src/modules/receivables/`. Ver [spec financeiro 004](docs/spec/financeiro/004-contas-a-receber.md).
- **Cancelar título (ação no grid de contas a pagar)** — Item **"Cancelar título"** no menu Ações (gated por `payables.cancel`; some quando o título já está cancelado). `ConfirmDialog` avisa que o cancelamento **exclui todas as baixas** do título; confirmando, `POST /api/payables/:id/cancel` roda em **transação** (`forUpdate` no título): apaga todas as `payable_settlements`, zera `paid_amount` e seta `status = 'cancelled'` (terminal — o único status que **não** deriva de `paid_amount`, nunca recalculado). Cancelado não edita/baixa/re-cancela (422). Verificado E2E (9 asserções).
- **Ativos (CRUD, filho de produtos)** — Cadastro pai-filho: um ativo/imobilizado pertence a um produto, e **só produtos `fixed_asset`** permitem ativos. Rotas aninhadas `/api/products/:productId/assets`; `productId` vem do path, service com `ensureParent` (404 neutro "Produto não encontrado."; 422 *"Este produto não permite ativos."* quando o produto é `consumable`). Página drill-down `/products/:productId/assets` (gated `product_assets.view`, **sem menu**), acessada por botão ícone `HardDrive` que **só aparece em linhas de produto `fixed_asset`** na tela de Produtos. Campos: descrição (obrigatória), cód. patrimônio, marca + modelo (FKs opcionais, **modelo em cascata** da marca — reusa `GET /brands/:brandId/models`), ano de fabricação, BTU, situação (Disponível/Alocado/Vendido, default Disponível), equipamento existe (checkbox), observação. Filtros: cód. patrimônio, descrição, situação. Form modal `max-w-2xl`. **Dependência de permissão**: roles com `product_assets.*` precisam também de `brands.view` + `brand_models.view` (mesma decisão de Produtos/subgrupos). Hard delete. Ver [spec 016](docs/spec/cadastros/016-criar-tela-ativos.md).
- **Grupos de despesa (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md). Classifica despesas por natureza (aluguel, combustível, correios). Menu **Cadastros → Grupos de despesa** (`/expense-groups`, ícone `ReceiptText`). Ver [spec 017](docs/spec/cadastros/017-criar-tela-grupo-de-despesa.md).
- **Parametrizações de LDF (CRUD)** — Cadastro mestre do **LDF (lançamento direto financeiro)**: gerar conta a pagar **sem documento formal**; o módulo de LDF em si ainda não existe. Não é simple-CRUD puro (tem FK), mas mantém a dinâmica da família (paginação 20, colunas ordenáveis, modal, hard delete, badge de status). Campos: descrição, **grupo de despesa (FK obrigatória)** e ativa. Listagem: Código (`id`, ordenável), Descrição, Grupo de despesa, Status. Filtros: código (igualdade exata), descrição (`like`) e grupo de despesa (`Select` alimentado por `/expense-groups`) — só consultam no clique em "Pesquisar". Grupo escolhido entre os **ativos**; na edição, o já vinculado continua selecionável mesmo inativo. Menu **Cadastros → Parametrizações de LDF** (`/ldf-parameters`, ícone `SlidersHorizontal`). Ver [spec 018](docs/spec/cadastros/018-criar-tela-parametrizacao-ldf.md).
- **Entrada de serviço (cabeçalho + itens, finaliza em contas a pagar)** — Primeira tela do módulo **Serviços** (grupo de menu novo, depois de Financeiro) e **primeira do sistema que escreve em outro módulo**: a nota fiscal de serviço vira a origem do título a pagar. Fluxo de status **aberta → finalizada → cancelada**, sem reabertura: só `open` edita/exclui, `finalize` (sobre `open`) gera os títulos, `cancel` (sobre `open` ou `finalized`) desfaz o efeito financeiro sem apagar o documento; `cancelled` é terminal. Cabeçalho com até 6 impostos (ISS/PIS/COFINS/INSS/IRRF/CSLL, zerados no backend quando a retenção é do **emissor**) e N itens (`service_entry_items`, `quantity` inteiro, total de linha derivado). **A conta da finalização**, tudo em centavos inteiros: `base = Σ itens − discount da nota − impostosRetidos` (`impostosRetidos` só existe quando `tax_withholding = 'recipient'`; pelo emissor, os 6 campos não abatem nada). O rateio é `splitInstallments(baseCents, count)` (`#utils/installments`) — parcelas iguais por `floor`, **resíduo inteiro na última** (R$ 1.000,00 em 3 → 333,33 + 333,33 + 333,34), soma sempre exata. Vencimentos por `installmentDueDates`: `first_due_date` mais `i` **meses** (não "+30 dias corridos", que arrastaria a data para trás no calendário); luxon resolve mês sem aquele dia para o último (31/01 + 1 mês = 28/02). Cada parcela vira um `payable` via `PayableService.createFromSource` (título com **um dono só** — o mesmo método que o futuro *lançamento direto financeiro* vai reusar), com `service_entry_id`, `installment` = ordinal e `notes` com o rastro legível. **A finalização passou a acionar o `auto_settlement`** dos tipos de pagamento — campo que existe desde `payment_types` (antes até do módulo de baixa) e que **nunca tinha sido acionado por nenhuma tela do sistema**: quando o tipo de pagamento escolhido tem `auto_settlement = true`, `PayableSettlementService.settleFullInTransaction` fecha cada título já **Pago**, com uma baixa cheia na data do **vencimento daquela parcela** (não na data da finalização). Tudo — títulos, baixas, `entry.status = 'finalized'` — em **uma transação**; qualquer rejeição (entrada não aberta, sem itens, base ≤ 0, base em centavos menor que o nº de parcelas) não persiste nada. **Cancelar** roda em lote sobre os títulos com `service_entry_id = entry.id` (mesma mecânica do cancelamento individual de título — apaga baixas, zera `paid_amount`, `status = 'cancelled'`); título já cancelado é pulado, não é erro. Frontend: listagem com os mesmos filtros sob demanda de contas a pagar (data da operação marcada no mês corrente por default), formulário em **rota dedicada** (4 seções: documento, impostos com `RadioGroup` emissor/destinatário, pagamento, serviços), `readOnly` na visualização, e `ConfirmDialog` de finalização com o resumo do parcelamento. **Todas as colunas de dados da listagem ordenam.** Fornecedor, tipo de documento e valor não são coluna da tabela — entram como `SORT_EXPRESSIONS` (subquery correlacionada, não `join`: o `paginate` do Lucid conta linhas, e uma fonte só no `from` não muda a contagem), e o valor ordena pela **mesma expressão que exibe**, senão a coluna se contradiria. **Status ordena pelo ciclo de vida** (`CASE`: aberta → finalizada → cancelada), não pela alfabética do slug em inglês, que colocaria "Cancelada" antes de "Aberta" — uma ordem que não corresponde a nada na tela. (Contas a pagar ainda ordena status pela alfabética do slug e tem esse mesmo defeito.) **O `Select` de serviço do sub-form lista só serviços `type = 'third_party'`**, com o filtro no servidor (`GET /services?type=third_party`): a entrada documenta a nota de um **fornecedor**, então serviço interno, executado pela própria empresa, não entra. Notas antigas com serviço interno não quebram — a tabela de itens exibe a descrição gravada no item, não uma busca na lista do `Select`. Ver [spec 001](docs/spec/servicos/001-criar-tela-entrada-de-servico.md).

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
- `GET|POST /payables`, `GET|PUT|DELETE /payables/:id`, `POST /payables/:id/cancel`
- `POST /payables/batch-settlements` *(pagamento em lote — gate `payable_settlements.batch`; registrada **antes** de `/:id`)*
- `GET|POST /payables/:payableId/settlements`, `PUT|DELETE /payables/:payableId/settlements/:id` *(baixas — drill-down)*
- `GET|POST /receivables`, `GET|PUT|DELETE /receivables/:id`, `POST /receivables/:id/cancel`
- `POST /receivables/batch-settlements` *(recebimento em lote — gate `receivable_settlements.batch`; antes de `/:id`)*
- `GET|POST /receivables/:receivableId/settlements`, `PUT|DELETE /receivables/:receivableId/settlements/:id` *(baixas — drill-down)*
- `GET|POST /expense-groups`, `GET|PUT|DELETE /expense-groups/:id`
- `GET|POST /ldf-parameters`, `GET|PUT|DELETE /ldf-parameters/:id` *(filtros `code`, `description`, `expenseGroupId`)*
- `GET|POST /service-entries`, `GET|PUT|DELETE /service-entries/:id`, `POST /service-entries/:id/finalize`, `POST /service-entries/:id/cancel` *(módulo Serviços; `finalize`/`cancel` vêm depois de `:id` no path, então nenhuma é capturada por ele — ordem de registro livre)*

**Lookup do EntityPicker** — autenticadas + empresa ativa, mas **sem gate de
permissão** (basta ter acesso à tela que usa o componente). Devolvem payload
mínimo. Registradas **antes** de `/:id`, senão o router casaria `lookup` como id:
- `GET /suppliers/lookup`, `GET /customers/lookup` *(`?q=` busca por nome ou documento; `?ids=` hidrata)*

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
`/brands/:brandId/models` *(drill-down — não está no menu)*, `/payables`,
`/receivables`, `/expense-groups`, `/ldf-parameters`, `/service-entries`,
`/service-entries/new`, `/service-entries/:id/edit`, `/service-entries/:id`
*(visualizar — form em `readOnly`)*.

Menu lateral: grupos **Cadastros**, **Financeiro**, **Serviços** e
**Configurações** (o grupo **Serviços** é novo, com "Entrada de serviço", entre
Financeiro e Configurações). Os grupos
**começam fechados** ao entrar na aplicação (nada abre sozinho, nem o grupo da
rota atual); expandir é ação explícita do usuário.

## Convenções importantes

- **Idioma**: código (tabelas, colunas, models, rotas, JSON da API) em inglês; textos visíveis ao usuário e mensagens de erro da API em português.
- **Multitenant**: toda `queryKey` no frontend inclui `tenant.companyId`. Toda query de negócio no backend é filtrada por `tenant.company.id` (exceto ROOT).
- **Máscaras**: CPF/CNPJ/CEP/telefone armazenados crus no banco; mascarados só na UI (`frontend/src/lib/masks.ts` + `MaskedInput`).
- **Centavos ↔ reais**: `reaisToCents`/`centsToReais` vivem em `frontend/src/lib/masks.ts` (promovidos de cópias locais em cada formulário monetário, a partir do módulo Entrada de serviço, que sozinho tinha 7 campos monetários no cabeçalho: o desconto da nota + os 6 impostos). **Sutileza**: essa versão de `centsToReais` devolve `0` para campo vazio — serve a campos monetários **obrigatórios** (`amount` de título, os campos da entrada de serviço), onde "sem valor" não é estado válido. Campo monetário **opcional/nullable** (`suggested_value` do serviço, `cost_price` do produto) **não** usa essa versão: mantém um `centsToReais` local no próprio formulário que devolve `undefined`/`null` para vazio, porque ali "vazio" e "R$ 0,00" são informações diferentes (gravar zero mentiria "custo definido como zero" onde o certo é "custo não definido").
- **Soft delete**: setar `deleted_at`; repositories filtram com `whereNull`.
- **Camadas backend**: HTTP → Middleware → Controller → Service → Repository → Model. Controllers finos, services com a lógica.
- **Cores só por token** (`bg-primary`, `text-destructive`, …), nunca fixas — é o que faz o dark mode funcionar. Tokens de estado disponíveis: `destructive` (vermelho), `success` (verde), `info` (azul), `secondary` (cinza), com variantes correspondentes no `Badge`.
- **Datas date-only**: usar `formatIsoDate` (`lib/format.ts`), **não** `formatDate`. `new Date('2026-07-13')` é meia-noite **UTC** e, no fuso do Brasil, exibe **um dia a menos**. (⚠️ `formatDate` ainda é usado em telas antigas e tem esse defeito.)
- **"Hoje" no backend**: `#utils/dates` (`todayIso`), que converte para `America/Sao_Paulo` — o servidor roda com `TZ=UTC` e o dia viraria às 21h de Brasília.
- **Query string**: o parser do Adonis **quebra vírgula em array** e o axios **manda a vírgula crua**. Params de lista (`?ids=1,2`, `?status=open,paid`) devem aceitar **string e array** — foi bug real no lookup.
- **`PageHeader`** aceita `icon`: toda tela exibe, ao lado do título, **o mesmo ícone do seu item de menu**.

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
- Specs de features, organizadas por contexto:
  - [`docs/spec/cadastros/`](docs/spec/cadastros/) — telas de cadastro (001–016).
  - [`docs/spec/financeiro/`](docs/spec/financeiro/) — telas do financeiro (001 = contas a pagar, 002 = baixa, 003 = pagamento em lote, 004 = contas a receber).
  - [`docs/spec/servicos/`](docs/spec/servicos/) — telas do módulo Serviços (001 = entrada de serviço).
  - [`docs/spec/comum/`](docs/spec/comum/) — **componentes e capacidades transversais**, que servem a vários contextos (001 = EntityPicker).
  - [`docs/superpowers/specs/`](docs/superpowers/specs/) — specs de design mais antigas.
- Regras de UI do projeto: [`frontend/.agents/skills/mpmweb-ui-patterns/`](frontend/.agents/skills/mpmweb-ui-patterns/).

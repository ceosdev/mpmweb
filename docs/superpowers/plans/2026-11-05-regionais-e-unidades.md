# Regionais e Unidades do cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar, dentro de **Cadastros → Clientes**, o cadastro em dois níveis **Cliente → Regional → Unidade**: telas filhas em drill-down, sem item de menu nem permissão própria. Prepara o terreno para a futura movimentação de ativos.

**Architecture:** O padrão **Marcas → Modelos** (`brand_models`) aplicado duas vezes em cascata.
- Duas tabelas novas: `customer_regions`, filha de `customers`, e `customer_units`, filha de `customer_regions`.
- Cada uma tem as camadas model → repository → service (com `ensureParent`) → controller e rotas aninhadas.
- No frontend, duas páginas drill-down. A tela de Clientes ganha um botão de navegação por linha.
- As permissões são as de `customers.*`: `view` para leitura e `edit` para escrita.

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL; React 19 + Vite + TanStack Query + RHF + Zod + shadcn/ui + Tailwind v4.

**Spec:** [`docs/spec/cadastros/020-criar-telas-regionais-e-unidades.md`](../../spec/cadastros/020-criar-telas-regionais-e-unidades.md). Leia a spec antes de começar, porque as **mensagens exatas** estão lá. Onde o plano e a spec divergirem, **a spec manda**.

Referência de implementação, para espelhar estrutura, nomes, comentários e idioma:
- **Backend:** Modelos (`backend/app/{models/brand_model,repositories/brand_model_repository,services/brand_model_service,validators/brand_model_validators,controllers/brand_models_controller}.ts`).
- **Frontend:** `frontend/src/modules/brand-models/` e `frontend/src/services/brand-models-api.ts`.
- **Filtro de situação:** copiar de Clientes (`parseStatus` em `customers_controller.ts`; filtro *Status* em `customers-page.tsx`).

## Global Constraints

- **Idioma:** código em inglês; UI e mensagens da API em português.
- **Multitenant:**
  - toda query filtra `tenant.company.id` e os pais do path;
  - toda `queryKey` inclui `companyId`;
  - os ids dos pais vêm **só do path**, nunca do body.
- **Camadas:** controller fino → service → repository → model.
- **Permissões:**
  - **nenhuma** nova; `catalog.ts` e `module-labels.ts` **não mudam**;
  - leitura (`index` e `show`) exige `customers.view`;
  - escrita (`store`, `update` e `destroy`) exige `customers.edit`.
- **Hard delete.** A FK violation (`23503`) vira 409 com a mensagem da spec.
- **Filtros só disparam no clique em Pesquisar** (`useSearchFilters` + `SearchButton`). Sem debounce.
- **Cores só por token.**
- **Sem testes automatizados**, por decisão do usuário mantida desde os módulos anteriores. Cada tarefa fecha com **typecheck + script de verificação executado + commit**.
- **Git:**
  - branch `feat/regionais-unidades`;
  - `git add` só dos arquivos da tarefa, nunca `-A`;
  - mensagens no estilo `feat(customer-regions): …`, terminando com a linha `Co-Authored-By` da sessão.

### Harness de verificação

Script descartável fora do repo, em `<scratchpad>/verify/api.mjs`.
- `login()`, `api()` e `check()`: exatamente como na seção *Harness de verificação* de [`2026-08-16-entrada-de-servico.md`](./2026-08-16-entrada-de-servico.md).
- Acrescente `loginAs(companyIndex)`, como em [`2026-10-27-funcionarios.md`](./2026-10-27-funcionarios.md). O ROOT do seed tem duas empresas.
- Acrescente `loginWith(email, password, companyIndex)`, para o teste de usuário sem `customers.edit`.

O backend precisa estar rodando (`cd backend && npm run dev`). Cada script cria os próprios dados com sufixo aleatório (clientes PJ com CNPJ válido, p.ex. `11222333000181`) e apaga o que criou no fim, na ordem unidade → regional → cliente.

## Review Focus

1. **Regional de outro cliente da mesma empresa na URL.** `GET|PUT|DELETE /customers/A/regions/{regional de B}` responde 404 *"Regional não encontrada."*, e `GET /customers/A/regions/{regional de B}/units` também responde 404. A empresa ser a mesma não basta. Teste nas Tasks 2 e 3.
2. **Unidade acessada pela regional errada do mesmo cliente.** `/customers/A/regions/R1/units/{unidade de R2}` responde 404 *"Unidade não encontrada."*. Teste na Task 3.
3. **Usuário só com `customers.view`.**
   - Na API: lista e consulta respondem 200; POST, PUT e DELETE respondem 403.
   - Na UI: vê os botões de navegação, mas não vê Novo, Editar nem Excluir.

   Teste nas Tasks 2 e 4.
4. **Descrição só com espaços** é recusada com 422 (o `trim` vem antes do mínimo de 1). Teste nas Tasks 2 e 3.
5. **Inativar a regional não toca nas unidades**: elas mantêm o `isActive` que tinham. Da regional inativa (com o filtro *Todas*) ainda se navega até as unidades. Teste nas Tasks 3 e 5.

---

## Estrutura de arquivos

**Backend — criar**
- `database/migrations/<ts>_create_customer_regions_table.ts`
- `database/migrations/<ts>_create_customer_units_table.ts`
- `app/models/customer_region.ts`, `app/models/customer_unit.ts`
- `app/repositories/customer_region_repository.ts`, `app/repositories/customer_unit_repository.ts`
- `app/validators/customer_region_validators.ts`, `app/validators/customer_unit_validators.ts`
- `app/services/customer_region_service.ts`, `app/services/customer_unit_service.ts`
- `app/controllers/customer_regions_controller.ts`, `app/controllers/customer_units_controller.ts`

**Backend — modificar**: `start/routes.ts`.

**Frontend — criar**
- `src/services/customer-regions-api.ts`, `src/services/customer-units-api.ts`
- `src/modules/customer-regions/customer-regions-page.tsx`, `customer-region-form-dialog.tsx`, `customer-display-name.ts`
- `src/modules/customer-units/customer-units-page.tsx`, `customer-unit-form-dialog.tsx`

**Frontend — modificar**: `src/types/api.ts`, `src/routes/router.tsx`, `src/modules/customers/customers-page.tsx`.

**Docs — modificar**: `state.md`.

---

### Task 1: Tabelas e models

**Files:** criar as 2 migrations e os 2 models.

**Interfaces — Produces:**
- Tabelas exatamente como a seção *Banco de dados* da spec.
  - `customer_regions`: `id`, `company_id`, `customer_id`, `description varchar(120)`, `is_active` default `true`, timestamps e índice `(customer_id, description)`.
  - `customer_units`: `id`, `company_id`, `customer_region_id`, `description varchar(120)`, `is_active` default `true`, timestamps e índice `(customer_region_id, description)`.
  - Todas as FKs com `onDelete('RESTRICT')`.
  - A migration de `customer_units` tem timestamp **posterior** à de regionais.
  - Os `down` fazem `dropTable`.
- Model `CustomerRegion` com `id`, `companyId`, `customerId`, `description`, `isActive`, `createdAt`, `updatedAt`.
- Model `CustomerUnit` com `id`, `companyId`, `customerRegionId`, `description`, `isActive`, `createdAt`, `updatedAt`.
- Os dois models seguem `BrandModel`.

- [ ] **Step 1:** Criar a branch `feat/regionais-unidades`. Criar as migrations (`node ace make:migration create_customer_regions_table` e depois `create_customer_units_table`) e os models.
- [ ] **Step 2:** Rodar `node ace migration:run`, depois `node ace migration:rollback` (desfaz as duas) e de novo `node ace migration:run`. Todos devem dar ok.
- [ ] **Step 3:** `psql ... -c "\d customer_units"` mostra a FK `customer_region_id` com `ON DELETE RESTRICT` e o índice.
- [ ] **Step 4:** `npm run typecheck` (backend) limpo. Commit `feat(customer-regions): tabelas e models de regionais e unidades`.

### Task 2: API de regionais

**Files:** criar `customer_region_repository.ts`, `customer_region_validators.ts`, `customer_region_service.ts` e `customer_regions_controller.ts`; modificar `start/routes.ts`.

**Interfaces — Consumes:**
- `CustomerRegion` (Task 1);
- `customerRepository.findById(companyId, id)`;
- `pickSort`, `queryInt`, `queryPositiveInt`;
- `ConflictException` e `NotFoundException`.

**Interfaces — Produces:**
- `customerRegionRepository`:
  - `query(companyId, customerId)`;
  - `findById(companyId, customerId, id)`, que devolve `null` se a regional não pertence **a esse cliente**.
- Rotas no grupo autenticado com tenant, logo após as de `/customers`:
  - `GET /customers/:customerId/regions` (`customers.view`);
  - `POST /customers/:customerId/regions` (`customers.edit`);
  - `GET /customers/:customerId/regions/:id` (`customers.view`);
  - `PUT /customers/:customerId/regions/:id` (`customers.edit`);
  - `DELETE /customers/:customerId/regions/:id` (`customers.edit`, responde 204).
- `customerId` e `regionId` entram em `NUMERIC_PARAMS` (o `regionId` já serve à Task 3).
- `GET` aceita `id`, `search`, `status` (`active` | `inactive` | `all`; ausente = sem filtro, como Clientes), `page`, `perPage`, `sort` (`id` | `description` | `is_active` | `created_at`) e `order`. Ordenação padrão `description asc`. A resposta é `{ data, meta }` como em `brand_models`.
- `serialize(row)` devolve `{ id, customerId, description, isActive, createdAt }`.
- Payload: `{ description: string (trim, 1–120), isActive?: boolean }`. No update, os dois campos são opcionais. As mensagens são as do `brand_model_validators.ts`.
- `customerRegionService.ensureParent(tenant, customerId)` é **público**, porque a Task 3 o reusa para validar o cliente.
- Erros:
  - cliente ausente → 404 *"Cliente não encontrado."*;
  - regional ausente → 404 *"Regional não encontrada."*;
  - FK violation no delete → 409 *"Não é possível excluir esta regional porque está em uso."*.

- [ ] **Step 1:** Repository, validators, service, controller e rotas espelhando Modelos, com o filtro `status` como em Clientes.
- [ ] **Step 2:** Script `<scratchpad>/verify/regions.mjs` com estes `check`s:
  - criar regional "Distrito 5" no cliente A → 201, `isActive: true` e `customerId === A`;
  - `description: '   '` → 422 (RF 4); `description` com 121 caracteres → 422;
  - body com `customerId` de outro cliente é ignorado: a regional nasce no cliente do path;
  - listagem:
    - `search=distr` acha a regional;
    - `status=active` esconde a inativada;
    - `status=all` mostra a inativada;
    - `sort=description&order=desc` ordena;
    - `sort=constructor` não dá 500;
  - regional de A pela URL do cliente B, da mesma empresa: GET, PUT e DELETE → 404 *"Regional não encontrada."* (RF 1);
  - cliente inexistente → 404 *"Cliente não encontrado."*; `/customers/abc/regions` → 404;
  - com os headers da segunda empresa (`loginAs(1)`), a regional de A → 404;
  - excluir o **cliente** A com a regional → 409 *"Não é possível excluir este cliente porque está em uso."*, e o cliente continua lá;
  - usuário só com `customers.view` → GET 200, POST/PUT/DELETE 403 (RF 3).
    - Criar no script um perfil com essa permissão e um usuário vinculado, pelo `POST /roles` e `POST /users`, como as telas fazem. Excluir os dois no fim.
  - excluir a regional (sem unidades) → 204, e o GET seguinte → 404.
- [ ] **Step 3:** Rodar o script: todos `ok`. `npm run typecheck` limpo.
- [ ] **Step 4:** Commit `feat(customer-regions): API de regionais do cliente`.

### Task 3: API de unidades

**Files:** criar `customer_unit_repository.ts`, `customer_unit_validators.ts`, `customer_unit_service.ts` e `customer_units_controller.ts`; modificar `start/routes.ts`.

**Interfaces — Consumes:**
- `CustomerUnit` (Task 1);
- `customerRegionService.ensureParent`;
- `customerRegionRepository.findById(companyId, customerId, regionId)` (Task 2).

**Interfaces — Produces:**
- `customerUnitRepository`:
  - `query(companyId, regionId)`;
  - `findById(companyId, regionId, id)`.
- Rotas (`view` para leitura, `edit` para escrita, como na Task 2):
  - `GET` e `POST /customers/:customerId/regions/:regionId/units`;
  - `GET`, `PUT` e `DELETE /customers/:customerId/regions/:regionId/units/:id`.
- `ensureParents(tenant, customerId, regionId)`:
  1. valida o cliente → 404 *"Cliente não encontrado."*;
  2. valida a regional **desse cliente** → 404 *"Regional não encontrada."*.

  Roda em **todas** as ações, inclusive `show`, `update` e `destroy`, antes de buscar a unidade.
- Listagem, filtros, ordenação e payload iguais aos da Task 2.
- `serialize(row)` devolve `{ id, customerRegionId, description, isActive, createdAt }`.
- Erros:
  - unidade ausente → 404 *"Unidade não encontrada."*;
  - FK violation → 409 *"Não é possível excluir esta unidade porque está em uso."*.

- [ ] **Step 1:** Repository, validators, service, controller e rotas.
- [ ] **Step 2:** Script `<scratchpad>/verify/units.mjs` com estes `check`s:
  - criar unidade "Romero Marques" em R1, do cliente A → 201 com `customerRegionId === R1`;
  - `description: '   '` → 422 (RF 4);
  - `/customers/A/regions/{R de B}/units` → 404 *"Regional não encontrada."* (RF 1);
  - `/customers/A/regions/R1/units/{unidade de R2}` → 404 *"Unidade não encontrada."* (RF 2);
  - excluir R1 com a unidade → 409 *"Não é possível excluir esta regional porque está em uso."*;
  - inativar R1 (`PUT isActive: false`) → as unidades continuam com o `isActive` que tinham, e `GET .../R1/units` continua 200 (RF 5);
  - listagem com `search`, `status` e `sort`, como na Task 2;
  - segunda empresa → 404;
  - excluir a unidade → 204; depois excluir R1 → 204.
- [ ] **Step 3:** Rodar o script de novo e o da Task 2: todos `ok`. `npm run typecheck` limpo.
- [ ] **Step 4:** Commit `feat(customer-units): API de unidades da regional`.

### Task 4: Tela de regionais e botão em Clientes

**Files:**
- criar `customer-regions-api.ts`, `customer-regions-page.tsx`, `customer-region-form-dialog.tsx` e `customer-display-name.ts`;
- modificar `types/api.ts`, `router.tsx` e `customers-page.tsx`.

**Interfaces — Consumes:** a API da Task 2; `customersApi.get(id)`.

**Interfaces — Produces:**
- Tipo `CustomerRegion` em `types/api.ts`, no shape do `serialize` da Task 2.
- `customerRegionsApi` com `list(customerId, params)`, `get(customerId, id)`, `create(customerId, payload)`, `update(customerId, id, payload)` e `remove(customerId, id)`, como em `brandModelsApi`. Os params têm `status`.
- `customerDisplayName(c: Pick<Customer, 'legalName' | 'tradeName'>): string` devolve `tradeName`, se preenchido, senão `legalName`.
- `queryKey`:
  - lista: `['customer-regions', companyId, customerId, listParams]`;
  - pai: `['customers', companyId, customerId]`.

  Salvar e excluir invalidam `['customer-regions', companyId, customerId]`.

- [ ] **Step 1:** `customer-regions-page.tsx` espelhando `brand-models-page.tsx`:
  - header "Regionais de {customerDisplayName}" e link "← Clientes";
  - filtros Código, Descrição e Status (default *Ativas*), com `useSearchFilters` e `SearchButton`;
  - colunas Código, Descrição, Status (badge Ativa/Inativa) e Ações; ordenáveis Código, Descrição e Status;
  - "Nova regional", Editar e Excluir em `Can customers.edit`;
  - botão-ícone `Building2` (title "Unidades") em `Can customers.view`, navegando para `/customers/:customerId/regions/:id/units`;
  - pai com 404 → o mesmo estado "não encontrado" de Modelos.
- [ ] **Step 2:** `customer-region-form-dialog.tsx` espelhando `brand-model-form-dialog.tsx`: Descrição e Situação, Zod com `trim().min(1).max(120)`. Erro do servidor → `toast.error(getErrorMessage(error))`.
- [ ] **Step 3:** Router: `customers/:customerId/regions` lazy, dentro de `PermissionRoute` `customers.view`, como a rota de Modelos. Em `customers-page.tsx`, o botão-ícone `Network` (title "Regionais") em `Can customers.view` vai antes do Editar.
- [ ] **Step 4:** `npx tsc --noEmit` limpo. Na UI, com front e back rodando:
  - Clientes → Regionais abre com o nome fantasia no header (cliente sem fantasia mostra a razão social);
  - criar, editar, inativar;
  - *Ativas* esconde a inativa e *Todas* mostra;
  - a busca só dispara no Pesquisar;
  - excluir com unidade → toast com a mensagem de 409;
  - `/customers/999999/regions` → "não encontrado".
  - Com o usuário só-`view` da Task 2 (recriado se apagado): vê os botões Regionais/Unidades, mas não vê Nova, Editar nem Excluir (RF 3).
- [ ] **Step 5:** Commit `feat(customer-regions): tela de regionais do cliente`.

### Task 5: Tela de unidades

**Files:** criar `customer-units-api.ts`, `customer-units-page.tsx` e `customer-unit-form-dialog.tsx`; modificar `types/api.ts` e `router.tsx`.

**Interfaces — Consumes:** a API da Task 3; `customerRegionsApi.get`, `customersApi.get` e `customerDisplayName` (Task 4).

**Interfaces — Produces:**
- Tipo `CustomerUnit`.
- `customerUnitsApi` com `list(customerId, regionId, params)`, `get`, `create`, `update` e `remove`, recebendo os dois ids do pai.
- `queryKey` da lista: `['customer-units', companyId, regionId, listParams]`.

- [ ] **Step 1:** A página espelha a Task 4:
  - header "Unidades de {regional}", com subtítulo do cliente (`customerDisplayName`);
  - link "← Regionais de {cliente}";
  - filtros, colunas e gates iguais, com "Nova unidade";
  - sem botão de navegação na linha (é folha).
- [ ] **Step 2:** O form-dialog espelha o da Task 4.
- [ ] **Step 3:** Router: `customers/:customerId/regions/:regionId/units` no mesmo `PermissionRoute` `customers.view`.
- [ ] **Step 4:** `npx tsc --noEmit` limpo. Na UI:
  - Clientes → Regionais → Unidades;
  - criar, editar, inativar, excluir;
  - inativar a regional e voltar: as unidades continuam como estavam;
  - pela regional inativa (filtro *Todas*) ainda se chega às unidades (RF 5);
  - o link de volta leva às regionais do mesmo cliente;
  - URL com a regional de outro cliente → "não encontrado".
- [ ] **Step 5:** Commit `feat(customer-units): tela de unidades da regional`.

### Task 6: Fechamento

**Files:** modificar `state.md`.

- [ ] **Step 1:** Rodar os scripts das Tasks 2 e 3 do zero: todos `ok`. `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) limpos.
- [ ] **Step 2:** Percorrer os **critérios de aceite** da spec um a um, anotando onde cada um foi verificado. O que faltar, verificar agora.
- [ ] **Step 3:** Atualizar `state.md`:
  - as duas tabelas no esquema (36 → **38 tabelas**);
  - o módulo "Regionais e Unidades do cliente" entregue: drill-down, permissões de `customers.*`, inativar não propaga, base para a movimentação de ativos;
  - as rotas de backend e frontend;
  - a data do snapshot.
- [ ] **Step 4:** Commit `docs(state): regionais e unidades do cliente`.

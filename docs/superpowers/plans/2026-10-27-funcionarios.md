# Funcionários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar **Cadastros → Funcionários**: CRUD multitenant com os 20 campos do Delphi, CPF opcional e único por empresa, e validação de datas — pré-requisito da Saída de Mercadoria.

**Architecture:** Cópia estrutural do CRUD de **Clientes** (`customers`): uma tabela nova `employees`, as mesmas camadas (model → repository → service → controller → rotas) e a mesma tela (listagem com `useSearchFilters` + formulário em modal). O que difere de Clientes: sem tipo PF/PJ, CPF opcional com **índice único parcial**, regras de data no service.

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL; React 19 + Vite + TanStack Query + RHF + Zod + shadcn/ui + Tailwind v4. Luxon para datas.

**Spec:** [`docs/spec/cadastros/019-criar-tela-funcionarios.md`](../../spec/cadastros/019-criar-tela-funcionarios.md) — leia antes; mensagens exatas estão lá. Onde plano e spec divergirem, **a spec manda**. Referência de implementação: Clientes (`backend/app/{models/customer,repositories/customer_repository,services/customer_service,validators/customer_validators,controllers/customers_controller}.ts`, `frontend/src/modules/customers/`, `frontend/src/services/customers-api.ts`) — espelhe estrutura, nomes, comentários e idioma.

## Global Constraints

- **Idioma**: código em inglês; UI e mensagens da API em português.
- **Multitenant**: toda query filtra `tenant.company.id`; a `queryKey` inclui `companyId`.
- **Camadas**: controller fino → service → repository → model.
- **Permissão nova = 2 arquivos**: `backend/app/abilities/catalog.ts` (`name`/`description` pt-BR) e `frontend/src/permissions/module-labels.ts` (`employees: 'Funcionários'`).
- **Vazio grava `null`**, nunca `''` — em especial `tax_id`, senão o índice único parcial pega dois vazios.
- **"Hoje"** = `todayIso()` de `#utils/dates` (fuso da aplicação; o servidor roda em UTC).
- **Cores só por token**; `PageHeader` com o ícone do menu (`IdCard`).
- **Sem testes automatizados** (decisão do usuário, mantida nos módulos anteriores). Cada tarefa fecha com **typecheck + verificação executada + commit**.
- **Git**: branch `feat/funcionarios`. `git add` só dos arquivos da tarefa, nunca `-A`.

### Harness de verificação

Script descartável fora do repo, em `<scratchpad>/verify/api.mjs`, com `login()`, `api()` e `check()` exatamente como na seção *Harness de verificação* de [`2026-08-16-entrada-de-servico.md`](./2026-08-16-entrada-de-servico.md). Acrescente `loginAs(companyIndex)`, que devolve os headers com `x-company-id` de `companies[companyIndex]` (o ROOT do seed tem duas empresas — necessário para o teste de multitenancy). Backend rodando (`cd backend && npm run dev`). Cada script cria os próprios dados com sufixo aleatório e apaga o que criou no fim.

CPFs válidos para os scripts: `52998224725`, `11144477735`, `12345678909`. Inválido: `12345678900`.

## Review Focus

1. **CPF digitado com máscara** (`529.982.247-25`) — o backend grava só os dígitos e a unicidade compara dígitos com dígitos. Teste na Task 2.
2. **Editar um funcionário enviando o próprio CPF** — não acusa duplicidade; e **limpar o CPF** na edição (`taxId: ''`) grava `null`, permitindo outro funcionário também sem CPF. Teste na Task 2.
3. **Demissão comparada com a admissão já gravada** — um update que manda só `terminatedAt` anterior ao `hired_at` existente é recusado (a regra usa o valor final mesclado, não só o payload). Teste na Task 2.
4. **Nascimento igual a hoje** passa; amanhã é recusado — "hoje" no fuso da aplicação, não em UTC. Teste na Task 2.
5. **Nome só com espaços** é recusado (o `trim` vem antes do mínimo de 1). Teste na Task 2.

---

## Estrutura de arquivos

**Backend — criar**
- `database/migrations/<ts>_create_employees_table.ts`
- `app/models/employee.ts`
- `app/repositories/employee_repository.ts`
- `app/validators/employee_validators.ts`
- `app/services/employee_service.ts`
- `app/controllers/employees_controller.ts`

**Backend — modificar**: `app/abilities/catalog.ts`, `start/routes.ts`.

**Frontend — criar**: `src/services/employees-api.ts`, `src/modules/employees/employees-page.tsx`, `src/modules/employees/employee-form-dialog.tsx`.

**Frontend — modificar**: `src/types/api.ts`, `src/permissions/module-labels.ts`, `src/permissions/menu.ts`, `src/routes/router.tsx`.

**Docs — modificar**: `state.md`.

---

### Task 1: Tabela, model e catálogo

**Files:** create migration e `app/models/employee.ts`; modify `app/abilities/catalog.ts`, `frontend/src/permissions/module-labels.ts`.

**Interfaces — Produces:**
- Tabela `employees` exatamente como o bloco da spec (seção *Decisões técnicas → Backend*), mais o índice parcial `employees_company_tax_id_uq` por `this.schema.raw(...)` no `up`; o `down` faz `dropTable`.
- Model `Employee` com as propriedades camelCase das colunas (`roleTitle`, `birthDate: DateTime | null`, `taxId`, `idNumber`, `workCard`, `pis`, `driverLicense`, `address`, `addressNumber`, `addressComplement`, `neighborhood`, `city`, `zipCode`, `phone`, `mobile`, `email`, `hiredAt: DateTime | null`, `terminatedAt: DateTime | null`, `isActive`). Datas `@column.date`, como `customerSince` em `Customer`.
- Catálogo: `employees.view` "Visualizar funcionários" / "Listar e consultar funcionários da empresa.", `employees.create` "Criar funcionários" / "Cadastrar novos funcionários.", `employees.edit` "Editar funcionários" / "Alterar funcionários existentes.", `employees.delete` "Excluir funcionários" / "Remover funcionários." — `module: 'employees'`, logo após o bloco de `customers`.

- [ ] **Step 1:** Criar a migration (`node ace make:migration create_employees_table`) e o model.
- [ ] **Step 2:** Catálogo + module-label.
- [ ] **Step 3:** `node ace migration:run` → ok; `node ace migration:rollback` → ok; `node ace migration:run` de novo → ok. `node ace db:seed` → ok.
- [ ] **Step 4:** Conferir o índice: `psql ... -c "\d employees"` lista `employees_company_tax_id_uq` como `UNIQUE ... WHERE tax_id IS NOT NULL`.
- [ ] **Step 5:** `npm run typecheck` (backend) limpo. Commit `feat(employees): tabela, model e permissões de funcionários`.

### Task 2: API de funcionários

**Files:** create `employee_repository.ts`, `employee_validators.ts`, `employee_service.ts`, `employees_controller.ts`; modify `start/routes.ts`.

**Interfaces — Consumes:** `Employee` (Task 1); `digitsOnly`, `isValidCpf` de `#utils/tax_id`; `todayIso` de `#utils/dates`; `BusinessException`, `ConflictException`, `NotFoundException` de `#exceptions/app_exception`.

**Interfaces — Produces:**
- Rotas sob o grupo autenticado com tenant, iguais às de `/customers` (sem `lookup`): `GET /employees` (`employees.view`), `POST /employees` (`employees.create`), `GET /employees/:id` (`employees.view`), `PUT /employees/:id` (`employees.edit`), `DELETE /employees/:id` (`employees.delete`, 204).
- `GET /employees` aceita `page`, `perPage`, `sort` (`id` | `name` | `tax_id` | `role_title` | `is_active`), `order` (`asc` | `desc`), `id`, `name`, `taxId`, `status` (`active` default | `inactive` | `all`); resposta paginada no mesmo formato de `/customers`.
- `serialize(row)` → `{ id, name, roleTitle, birthDate, taxId, idNumber, workCard, pis, driverLicense, address, addressNumber, addressComplement, neighborhood, city, zipCode, phone, mobile, email, hiredAt, terminatedAt, isActive, createdAt, updatedAt }`, datas date-only como `'YYYY-MM-DD'` ou `null`.
- Payload de create/update: os mesmos campos camelCase, todos opcionais exceto `name`.

Regras no service (mensagens da spec, todas `BusinessException` 422 salvo indicação):
- `birthDate > todayIso()` → *"A data de nascimento não pode ser futura."*
- Valor final mesclado (payload sobre a linha gravada) com `terminatedAt < hiredAt` → *"A data de demissão não pode ser anterior à data de admissão."*
- `taxId` não nulo já usado por outro funcionário da empresa (`id <> :id` no update) → *"Já existe um funcionário com este CPF."*; a mesma mensagem quando o insert/update estourar `23505` com `constraint === 'employees_company_tax_id_uq'` (helper local `isUniqueViolation(error, constraint)`, no mesmo estilo do `isForeignKeyViolation` local dos services).
- Exclusão com FK violation → `ConflictException` *"Não é possível excluir este funcionário porque está em uso."*; id de outra empresa → `NotFoundException` *"Funcionário não encontrado."*

Validator (VineJS, mensagens pt-BR): `name` `trim` 1–120; `taxId` opcional, normalizado com `digitsOnly`, vazio → `null`, preenchido exige 11 dígitos + `isValidCpf` → *"CPF inválido."*; demais campos conforme a tabela da spec (`zipCode` 8 dígitos, `phone`/`mobile` 10–11, `email` formato).

- [ ] **Step 1:** Repository, validators, service, controller e rotas espelhando Clientes.
- [ ] **Step 2:** Script `<scratchpad>/verify/employees.mjs` com estes `check`s:
  - criar só com `name` → 201, todos os outros campos `null`, `isActive: true`;
  - `name: '   '` → 422 (Review Focus 5);
  - `taxId: '529.982.247-25'` → 201 e `taxId === '52998224725'` (RF 1); outro com `'52998224725'` → 422 *"Já existe um funcionário com este CPF."*;
  - `taxId: '12345678900'` → 422 *"CPF inválido."*;
  - update do primeiro reenviando o próprio CPF → 200 (RF 2); update com `taxId: ''` → 200 e `taxId === null`; criar outro sem CPF → 201 (dois `null`) (RF 2);
  - o mesmo CPF na **segunda empresa** (`loginAs(1)`) → 201;
  - `birthDate` = hoje → 201; amanhã → 422 (RF 4);
  - create com `hiredAt '2026-05-10'`, depois update só com `terminatedAt '2026-05-09'` → 422; `'2026-05-10'` → 200 (RF 3);
  - `terminatedAt` preenchido mantém `isActive: true`;
  - `zipCode '1234'` → 422; `phone '123'` → 422; `email 'x@'` → 422;
  - listagem: default só ativos; `status=all` traz o inativo; `name` parcial; `taxId=5299` acha; `id` exato; `sort=name&order=desc` ordena; a segunda empresa não vê os funcionários da primeira;
  - `GET`/`PUT`/`DELETE` do id da primeira empresa usando os headers da segunda → 404;
  - excluir → 204 e `GET` → 404.
- [ ] **Step 3:** Rodar o script → todos `ok`. `npm run typecheck` limpo.
- [ ] **Step 4:** Commit `feat(employees): API do cadastro de funcionários`.

### Task 3: Tela de funcionários

**Files:** create `employees-api.ts`, `employees-page.tsx`, `employee-form-dialog.tsx`; modify `types/api.ts`, `menu.ts`, `router.tsx`.

**Interfaces — Consumes:** a API da Task 2.

**Interfaces — Produces:**
- Tipos `Employee`, `EmployeeListParams`, `EmployeePayload` em `types/api.ts` (shape do `serialize` da Task 2).
- `employeesApi`: `list(params)`, `get(id)`, `create(payload)`, `update(id, payload)`, `remove(id)` — como `customersApi`.
- `queryKey`: `['employees', companyId, listParams]`; salvar/excluir invalidam `['employees', companyId]`.

- [ ] **Step 1:** Listagem espelhando `customers-page.tsx`: filtros Código / Nome / CPF (`MaskedInput`) / Status (default *Ativos*) com `useSearchFilters`; colunas Código, Nome, CPF (`maskTaxId`, traço), Função (traço), Celular (`mobile`, senão `phone`, com `maskPhone`, senão traço), Status (badge), Ações; ordenáveis Código, Nome, CPF, Função, Status; botão "Novo funcionário" em `Can employees.create`; `ConfirmDialog` de excluir.
- [ ] **Step 2:** `employee-form-dialog.tsx` espelhando `customer-form-dialog.tsx`: modal `max-w-3xl`, 5 seções (Identificação, Documentos, Endereço, Contato, Contrato), 2 colunas no desktop. Zod espelha o backend: nome obrigatório, CPF opcional com `isValidCpf` (`lib/tax-id.ts`), nascimento ≤ hoje, demissão ≥ admissão (mensagens da spec, erro no campo `terminatedAt`), CEP/telefones/e-mail. Strings vazias viram `null` no payload. Erro do servidor → `toast.error(getErrorMessage(error))`.
- [ ] **Step 3:** Menu: folha "Funcionários" (`IdCard`, `employees.view`) entre "Fornecedores" e "Grupos de despesa". Router: `/employees` lazy em `PermissionRoute` `employees.view`.
- [ ] **Step 4:** `npx tsc --noEmit` limpo. Na UI (front + back rodando): criar funcionário só com nome; criar outro com CPF mascarado; tentar CPF repetido → toast com a mensagem da spec; demissão antes da admissão → erro no campo sem chamar a API; editar e inativar; filtro *Ativos* esconde o inativo e *Todos* mostra; filtrar, abrir um registro e voltar mantém os filtros; excluir. Conferir em Configurações → Permissões que o módulo aparece como "Funcionários". Sidebar com todos os grupos abertos ainda rola até o fim.
- [ ] **Step 5:** Commit `feat(employees): tela de funcionários`.

### Task 4: Fechamento

**Files:** modify `state.md`.

- [ ] **Step 1:** Rodar o script da Task 2 do zero → todos `ok`. `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) limpos.
- [ ] **Step 2:** Percorrer os **critérios de aceite** da spec um a um, anotando onde cada um foi verificado; o que não tiver verificação, verificar agora.
- [ ] **Step 3:** `state.md`: tabela `employees` no esquema (31 tabelas), módulo "Funcionários" entregue (com CPF único parcial e demissão independente do status), rotas backend/frontend, item de menu, data do snapshot. Na seção de pendências, registrar que a análise da **Saída de Mercadoria** está pausada aguardando este cadastro e agora pode ser retomada.
- [ ] **Step 4:** Commit `docs(state): cadastro de funcionários`.

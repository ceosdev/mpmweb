# Spec: Criar tela de funcionários

> ⚠️ **Não é simple-CRUD puro.** O cadastro tem 20 campos, CPF único por
> empresa e validação entre datas. Mantém a **mesma dinâmica** da família
> (paginação 20/página server-side, ordenação por colunas, formulário em modal,
> hard delete, badge de status, multitenant) e espelha o spec
> [011 — Clientes](./011-criar-tela-clientes.md) em endereço, contato, máscaras e
> validação de CPF.

## Problema

A futura tela de **Saída de Mercadoria** (grupo Mercadoria) registra quem
consumiu produtos de uso e consumo e quem levou ferramentas: o consumidor é um
**ativo** ou um **funcionário**. O web ainda não tem cadastro de funcionários —
no Delphi é a tabela `CAD_FUNCIONARIO_FUN` (tela `UFrmFuncionarios`).

## Solução proposta

Criar o CRUD de funcionários da empresa ativa, com os mesmos campos do Delphi.

- A entidade é **por empresa** (multitenant). Toda query é filtrada por
  `tenant.company.id`.
- Gerar as 4 permissões: `employees.view`, `employees.create`, `employees.edit`,
  `employees.delete`. ROOT recebe tudo via curinga `*`.
- Formulário em **modal** `max-w-3xl` com seções, como Clientes.
- Item no menu lateral, grupo **"Cadastros"**.

## Domínio

- **Entidade**: funcionário.
- **Exemplos**: *Elton* (técnico de refrigeração, admitido em 2024); *Maria
  Souza* (auxiliar de almoxarifado).
- **Justificativa de negócio**: a Saída de Mercadoria precisa apontar para um
  funcionário cadastrado — este é o cadastro mestre.

## Específicos do módulo

- **Tabela**: `employees`
- **Slug do módulo**: `employees`
- **Endpoints**: `/api/employees`
- **Rota frontend**: `/employees`
- **Módulo frontend**: `src/modules/employees/`
- **Ícone (lucide-react)**: `IdCard`
- **Label do menu**: "Funcionários"
- **Grupo do menu**: "Cadastros"
- **Rótulo do módulo** (`module-labels.ts`): `employees: 'Funcionários'`

## Campos

| Campo (UI, pt-BR)  | Coluna (DB, en)      | Tipo                     | Obrigatório | Observações |
| ------------------ | -------------------- | ------------------------ | ----------- | ----------- |
| Nome               | `name`               | `varchar(120)`           | sim         | Único campo obrigatório, como no Delphi. |
| Função             | `role_title`         | `varchar(80)`            | não         | Cargo/função. Não se chama `role` porque `role` já é o perfil de acesso no RBAC. |
| Data de nascimento | `birth_date`         | `date`                   | não         | Não pode ser futura. |
| CPF                | `tax_id`             | `char(11)`               | não         | Só dígitos; exibido com máscara. Quando preenchido: 11 dígitos + `isValidCpf`. **Único por empresa** (ver regras). |
| RG                 | `id_number`          | `varchar(20)`            | não         | Texto livre (formato varia por UF). |
| CTPS               | `work_card`          | `varchar(30)`            | não         | Texto livre. |
| PIS                | `pis`                | `varchar(20)`            | não         | Texto livre, sem validação de dígito. |
| CNH                | `driver_license`     | `varchar(20)`            | não         | Texto livre. |
| Endereço           | `address`            | `varchar(160)`           | não         | Logradouro (sem número). |
| Número             | `address_number`     | `varchar(20)`            | não         | Aceita "S/N", "100 A". |
| Complemento        | `address_complement` | `varchar(80)`            | não         | Não existe no Delphi; entra para ficar igual a Clientes. |
| Bairro             | `neighborhood`       | `varchar(80)`            | não         | |
| Cidade             | `city`               | `varchar(80)`            | não         | |
| CEP                | `zip_code`           | `char(8)`                | não         | Só dígitos. |
| Telefone           | `phone`              | `varchar(20)`            | não         | Só dígitos, 10–11. |
| Celular            | `mobile`             | `varchar(20)`            | não         | Só dígitos, 10–11. |
| E-mail             | `email`              | `varchar(160)`           | não         | Valida formato. Sem unicidade. |
| Data de admissão   | `hired_at`           | `date`                   | não         | Aceita futura (contratação agendada). |
| Data de demissão   | `terminated_at`      | `date`                   | não         | Quando as duas datas existem: demissão ≥ admissão. |
| Status             | `is_active`          | `boolean` default `true` | sim         | Toggle no form; badge "Ativo"/"Inativo". **Independente da demissão.** |

> **Idioma**: colunas em inglês; labels e mensagens em português. Máscaras de
> CPF, CEP e telefones já existem em
> [`frontend/src/lib/masks.ts`](../../../frontend/src/lib/masks.ts) e o
> validador de CPF em `frontend/src/lib/tax-id.ts` / `backend/app/utils/tax_id.ts`.

## Comportamento esperado

### Fluxo feliz

- O usuário com `employees.view` acessa pelo menu ("Cadastros" →
  "Funcionários").
- Vê a listagem paginada (20 por página, server-side) com as colunas:
  - **Código** (`id`, ordenável)
  - **Nome** (ordenável, asc por default)
  - **CPF** (mascarado, ordenável; traço se vazio)
  - **Função** (ordenável; traço se vazio)
  - **Celular** (mascarado; mostra `mobile`, senão `phone`, senão traço)
  - **Status** (badge "Ativo"/"Inativo", ordenável)
  - **Ações** (Editar / Excluir)
- Clica em "Novo funcionário" (gated por `employees.create`) → modal
  `max-w-3xl` em seções:
  1. **Identificação** — Nome, Função, Data de nascimento
  2. **Documentos** — CPF, RG, CTPS, PIS, CNH
  3. **Endereço** — CEP, Endereço, Número, Complemento, Bairro, Cidade
  4. **Contato** — Telefone, Celular, E-mail
  5. **Contrato** — Data de admissão, Data de demissão, Status (toggle, default ativo)
- Preenche o Nome (único obrigatório) e salva. O modal fecha, a listagem
  atualiza e aparece um toast de sucesso.

### Fluxos alternativos

- **Editar**: botão editar (gated por `employees.edit`) abre o mesmo modal
  preenchido.
- **Excluir**: botão excluir (gated por `employees.delete`) → `ConfirmDialog` →
  **hard delete**. FK violation (a futura Saída de Mercadoria) → 409:
  *"Não é possível excluir este funcionário porque está em uso."* O caminho
  para quem já foi usado é inativar.
- **Inativar / reativar**: editar e trocar o toggle de status.
- **Demitir**: preencher a data de demissão **não** muda o status sozinho. Quem
  some da Saída de Mercadoria é o inativo.

### Filtros

Uma linha entre o `PageHeader` e o `Card` (regra `crud-search-and-filters`):

| Filtro | Tipo          | Comportamento |
| ------ | ------------- | ------------- |
| Nome   | `Input`       | Debounce 350 ms; `lower(name) like %?%`. |
| CPF    | `MaskedInput` | Debounce 350 ms; `tax_id like %?%` sobre os dígitos. Match parcial. |
| Status | `Select`      | *Todos*, *Ativos*, *Inativos*. Default *Ativos*. |

- Mudar qualquer filtro volta `page` para 1.
- Todos os filtros entram na `queryKey` e nos query params do GET.
- "Limpar filtros" só aparece com filtro ativo e volta o status a *Ativos*.

### Regras de negócio

- **Multitenant**: funcionários pertencem à empresa ativa; ninguém vê os de
  outra empresa (exceto ROOT).
- **CPF**:
  - Opcional. Vazio grava `null` (nunca string vazia — senão a unicidade
    pegaria dois vazios).
  - Preenchido: exatamente 11 dígitos e dígito verificador válido, senão 422
    *"CPF inválido."*
  - **Único por empresa**: já existir outro funcionário da mesma empresa com o
    mesmo CPF → 422 *"Já existe um funcionário com este CPF."* Vários
    funcionários **sem** CPF são permitidos. O mesmo CPF em empresas diferentes
    é permitido.
- **Datas**:
  - Nascimento não pode ser futura (422 *"A data de nascimento não pode ser
    futura."*). "Hoje" no fuso da aplicação (`#utils/dates`).
  - Admissão e demissão aceitam qualquer data; com as duas preenchidas,
    demissão < admissão → 422 *"A data de demissão não pode ser anterior à
    data de admissão."*
- **Status e demissão são independentes** (decisão do usuário, igual ao Delphi).
- **CEP** com 8 dígitos e telefones com 10–11 dígitos quando preenchidos.
- **E-mail** opcional; quando preenchido, formato válido.
- **RG, CTPS, PIS, CNH**: texto livre, `trim`, vazio → `null`.
- **Ordenação default**: nome asc. Ordenáveis: Código, Nome, CPF, Função,
  Status.
- **Paginação**: 20/página server-side.
- **Exclusão**: hard delete.

## Fora de escopo

- **Ferramentas do funcionário** (`CAD_FERRAMENTAS_FUNC_FFU` no Delphi — lista
  de texto livre com descrição e quantidade). Decisão do usuário: o controle de
  quem está com qual ferramenta passa a ser a **Saída de Mercadoria do tipo
  Ferramenta**, ligada ao estoque.
- Vínculo funcionário ↔ usuário do sistema.
- Importação do funcionário existente no Delphi.
- Validação de dígito de PIS, CNH ou RG.
- Inativação automática pela demissão.
- Consulta de CEP, anexos, histórico/auditoria.
- A própria Saída de Mercadoria (spec do grupo Mercadoria, análise pausada até
  este cadastro existir).

## Decisões técnicas

### Backend

- **Migration** `create_employees_table`:
  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table.string('name', 120).notNullable()
  table.string('role_title', 80).nullable()
  table.date('birth_date').nullable()

  table.specificType('tax_id', 'char(11)').nullable()
  table.string('id_number', 20).nullable()
  table.string('work_card', 30).nullable()
  table.string('pis', 20).nullable()
  table.string('driver_license', 20).nullable()

  table.string('address', 160).nullable()
  table.string('address_number', 20).nullable()
  table.string('address_complement', 80).nullable()
  table.string('neighborhood', 80).nullable()
  table.string('city', 80).nullable()
  table.specificType('zip_code', 'char(8)').nullable()

  table.string('phone', 20).nullable()
  table.string('mobile', 20).nullable()
  table.string('email', 160).nullable()

  table.date('hired_at').nullable()
  table.date('terminated_at').nullable()
  table.boolean('is_active').notNullable().defaultTo(true)

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'name'], 'employees_company_name_idx')
  ```
  E, por SQL cru (o knex não cria índice parcial com `unique()`):
  ```sql
  CREATE UNIQUE INDEX employees_company_tax_id_uq
    ON employees (company_id, tax_id) WHERE tax_id IS NOT NULL
  ```
  Sem `deleted_at` (hard delete).

- **Catálogo** (`backend/app/abilities/catalog.ts`): módulo `employees` com
  `view`, `create`, `edit`, `delete`; `name`/`description` em pt-BR
  ("Visualizar funcionários", "Listar e consultar funcionários da empresa.",
  etc.).

- **Camadas**: `Employee` model → `employee_repository` → `employee_service` →
  `employees_controller` → rotas em `start/routes.ts` sob `/api/employees` com
  `middleware.tenant()` e `middleware.permission(...)` por ação.

- **Validator VineJS** (mensagens pt-BR):
  - `name`: `trim`, 1–120.
  - `roleTitle`, `idNumber`, `workCard`, `pis`, `driverLicense`, `address`,
    `addressNumber`, `addressComplement`, `neighborhood`, `city`: `trim`,
    opcionais, máx. conforme a tabela; vazio → `null`.
  - `taxId`: opcional; remove não-dígitos; vazio → `null`; preenchido → 11
    dígitos + `isValidCpf` (`#utils/tax_id`).
  - `zipCode`: opcional, 8 dígitos. `phone`/`mobile`: opcionais, 10–11 dígitos.
  - `email`: opcional, formato válido.
  - `birthDate`, `hiredAt`, `terminatedAt`: opcionais, data ISO.
  - `isActive`: boolean, default `true` no create.

- **Service** (regras que o validator não cobre):
  - Nascimento futura → 422.
  - `terminatedAt < hiredAt` → 422.
  - **Unicidade do CPF**: antes de gravar, procura outro funcionário da mesma
    empresa com o mesmo `tax_id` (excluindo o próprio `id` no update) → 422
    no campo `taxId`. O índice parcial é a rede de segurança: se uma corrida
    passar pela checagem, a violação `23505` de `employees_company_tax_id_uq`
    também vira o mesmo 422.

- **Listagem**: `page`, `perPage`, `sort`, `name`, `taxId`, `status`
  (`active` | `inactive` | `all`, default `active`). Ordenação default
  `name asc`.

- **Erro de FK na exclusão** → 409 *"Não é possível excluir este funcionário
  porque está em uso."* (mesmo tratamento de Clientes).

- **Seeder**: só as permissões. Sem funcionários pré-cadastrados.

### Frontend

- **Rota** `/employees` em `routes/router.tsx`, gated por `employees.view`, com
  `lazy()`.
- **Menu** (`permissions/menu.ts`): grupo "Cadastros", ordem alfabética — entre
  "Fornecedores" e "Grupos de despesa"; ícone `IdCard`.
- **Rótulo** `employees: 'Funcionários'` em `permissions/module-labels.ts`.
- **Página** `src/modules/employees/employees-page.tsx` com os blocos
  compartilhados: `PageHeader` (ícone `IdCard`), `Pagination`,
  `SortableHeader`, `EmptyState`, `ConfirmDialog`, `Can`, `Skeleton`, `Badge`,
  `MaskedInput`. Filtros persistem ao abrir um registro e voltar, como nas
  demais listagens.
- **Formulário** `src/modules/employees/employee-form-dialog.tsx`: React Hook
  Form + Zod (espelha as regras do backend, incluindo CPF e demissão ≥
  admissão), modal `max-w-3xl`, 5 seções (ver "Fluxo feliz"), 2 colunas no
  desktop e 1 no mobile. Erro 422 do backend no `taxId` aparece no próprio
  campo.
- **API client**: `src/services/employees-api.ts`.
- **Tipo `Employee`** em `src/types/api.ts`.
- **QueryKey**: `['employees', companyId, debouncedName, debouncedTaxId, status, page, sort]`.
- **Exibição**: CPF via `formatTaxId`, telefones via `formatPhone`, traço para
  vazios.

## Critérios de aceite

- [ ] Migration cria `employees` com FK, índice `(company_id, name)` e o índice
      único parcial de CPF; `up` e `down` rodam limpas.
- [ ] Catálogo traz `employees.view/create/edit/delete` (pt-BR); ROOT acessa por
      curinga; rótulo "Funcionários" aparece nas telas de Permissões/Perfis/Usuários.
- [ ] `/api/employees` (listar, criar, detalhe, editar, excluir) com gates de
      permissão e escopo de tenant.
- [ ] Menu mostra "Funcionários" em "Cadastros", entre "Fornecedores" e "Grupos
      de despesa", para quem tem `employees.view`.
- [ ] Listagem 20/página, default nome asc; Código, Nome, CPF, Função e Status
      ordenáveis.
- [ ] Filtros: nome (`like`), CPF (dígitos parciais), status default *Ativos*;
      "Limpar filtros" condicional volta a *Ativos*.
- [ ] Salvar só com o Nome funciona; todos os demais campos aceitam vazio e
      gravam `null`.
- [ ] CPF inválido → 422 *"CPF inválido."*
- [ ] CPF repetido na mesma empresa → 422 *"Já existe um funcionário com este
      CPF."*; editar o próprio funcionário mantendo o CPF não acusa duplicidade;
      dois funcionários sem CPF salvam; o mesmo CPF em outra empresa salva.
- [ ] Nascimento futura → 422; demissão anterior à admissão → 422.
- [ ] Preencher a demissão não altera o status.
- [ ] CEP exige 8 dígitos; telefones 10–11; e-mail inválido → 422.
- [ ] Excluir abre `ConfirmDialog`; hard delete; FK violation → 409 pt-BR.
- [ ] Trocar de empresa mostra só os funcionários da empresa ativa.
- [ ] Inativos ficam ocultos por default e aparecem com *Todos*/*Inativos*.

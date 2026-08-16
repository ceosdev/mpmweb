# Entrada de Serviço — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o módulo **Serviços → Entrada de Serviço**: cadastro da nota fiscal de serviço (cabeçalho + itens), que ao ser **finalizada** gera os títulos parcelados em contas a pagar e, ao ser **cancelada**, cancela esses títulos.

**Architecture:** Duas tabelas novas (`service_entries`, `service_entry_items`) e uma coluna de origem em `payables` (`service_entry_id`, nullable, `RESTRICT`). A finalização roda numa `db.transaction` com `forUpdate()` na entrada: calcula a base em centavos, divide com uma função pura, e delega a criação de cada título a um método novo do `PayableService` — o título continua com um dono só. Frontend com formulário em **rota dedicada** (não modal), porque são 4 seções mais uma grade editável de itens.

**Tech Stack:** AdonisJS 6 + Lucid + VineJS + PostgreSQL (backend); React 19 + Vite + TanStack Query + React Hook Form + Zod + shadcn/ui + Tailwind v4 (frontend). Luxon para datas.

**Spec:** [`docs/spec/servicos/001-criar-tela-entrada-de-servico.md`](../../spec/servicos/001-criar-tela-entrada-de-servico.md) — leia antes de começar. O plano argumenta a partir dela; onde os dois divergirem, a spec manda.

---

## Global Constraints

- **Idioma**: código (tabelas, colunas, models, rotas, JSON da API) em **inglês**; textos visíveis ao usuário e mensagens de erro da API em **português**.
- **Multitenant**: toda query de negócio filtra por `tenant.company.id`. Toda `queryKey` do frontend inclui `tenant.companyId`.
- **Camadas backend**: HTTP → Middleware → Controller → Service → Repository → Model. Controllers finos; a regra fica no service.
- **Dinheiro em centavos inteiros** para qualquer comparação ou divisão. Colunas `decimal` voltam do driver como **string** — sempre passar por `Number(...)`. Nunca comparar reais em ponto flutuante.
- **"Hoje"** vem de `todayIso()` (`#utils/dates`, fuso `America/Sao_Paulo`). O servidor roda com `TZ=UTC`; nunca usar `new Date()` para o dia.
- **Datas date-only no frontend**: `formatIsoDate` (`lib/format.ts`). **Nunca** `formatDate` — tem defeito de fuso.
- **Cores só por token** (`bg-primary`, `text-destructive`, `bg-success`, …), nunca fixas — é o que faz o dark mode funcionar.
- **Toda permissão nova exige DOIS arquivos**: `backend/app/abilities/catalog.ts` **e** `frontend/src/permissions/module-labels.ts`. Sem o segundo, as telas de Permissões/Perfis/Usuários exibem o slug cru em inglês.
- **Escrita multi-tabela roda em `db.transaction`**, com `forUpdate()` na linha pai.
- **Sem testes automatizados** (decisão do usuário — o projeto nunca escreveu um, apesar do japa estar configurado). Cada tarefa fecha com **typecheck + verificação executada + commit**. Ver *Harness de verificação* abaixo.

### Estado da árvore ao começar

Há trabalho **não commitado** de outro módulo (*Grupo de despesa*, spec 017) modificando `catalog.ts`, `start/routes.ts`, `menu.ts`, `module-labels.ts`, `router.tsx` e `types/api.ts` — os mesmos arquivos compartilhados que este plano toca. **Não reverta, não commite e não reorganize esse trabalho.** Faça suas edições por cima, e nos `git add` liste **apenas os seus arquivos**, nunca `git add -A`.

### Harness de verificação

Cada tarefa de backend é verificada por um script descartável no scratchpad (não vai para o repo). Crie uma vez, no início da Task 4:

```bash
mkdir -p /tmp/claude-1000/mpmweb-verify
cat > /tmp/claude-1000/mpmweb-verify/api.mjs <<'EOF'
const BASE = 'http://localhost:3333/api'

export async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'carlossantana.desenv@gmail.com', password: '12345678' }),
  })
  if (!r.ok) throw new Error(`login falhou: ${r.status} ${await r.text()}`)
  const { accessToken, companies } = await r.json()
  return {
    'content-type': 'application/json',
    'authorization': `Bearer ${accessToken}`,
    'x-company-id': String(companies[0].id),
  }
}

export async function api(headers, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: r.status, body: json }
}

export function check(label, condition, detail) {
  if (condition) { console.log(`  ok   ${label}`); return true }
  console.log(`  FAIL ${label}`, detail === undefined ? '' : JSON.stringify(detail))
  process.exitCode = 1
  return false
}
EOF
```

> O shape do `POST /auth/login` (campos `accessToken` e `companies`) pode diferir. **Confirme rodando o login uma vez e imprimindo a resposta** antes de escrever o primeiro script de verificação; ajuste o helper se necessário.

O backend precisa estar rodando (`cd backend && npm run dev`) para qualquer verificação de API.

---

## Estrutura de arquivos

**Backend** (`backend/`)

| Arquivo | Responsabilidade |
| --- | --- |
| `database/migrations/*_create_service_entries_table.ts` | Cabeçalho da nota. |
| `database/migrations/*_create_service_entry_items_table.ts` | Itens (serviços) da nota. |
| `database/migrations/*_add_service_entry_id_to_payables.ts` | Coluna de origem no título. |
| `app/models/service_entry.ts` | Model do cabeçalho + tipo `ServiceEntryStatus`. |
| `app/models/service_entry_item.ts` | Model do item. |
| `app/models/payable.ts` | **Modificar**: coluna `serviceEntryId`. |
| `app/abilities/catalog.ts` | **Modificar**: 6 permissões `service_entries.*`. |
| `app/utils/installments.ts` | `splitInstallments` + `installmentDueDates` — **funções puras**, sem banco. |
| `app/repositories/service_entry_repository.ts` | Queries escopadas por empresa. |
| `app/services/service_entry_service.ts` | CRUD + `finalize` + `cancel` + a conta da base. |
| `app/services/payable_service.ts` | **Modificar**: `createFromSource`. |
| `app/services/payable_settlement_service.ts` | **Modificar**: `settleFullInTransaction`. |
| `app/validators/service_entry_validators.ts` | Schemas VineJS (mensagens pt-BR). |
| `app/controllers/service_entries_controller.ts` | Entrada HTTP. |
| `start/routes.ts` | **Modificar**: 7 rotas com gate por permissão. |

**Frontend** (`frontend/src/`)

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/masks.ts` | **Modificar**: promover `reaisToCents`/`centsToReais` (hoje duplicados em 6 módulos). |
| `components/ui/radio-group.tsx` | **Novo primitivo** — o projeto não tem radio. |
| `types/api.ts` | **Modificar**: `ServiceEntry`, `ServiceEntryItem`, payloads. |
| `services/service-entries-api.ts` | Chamadas HTTP tipadas. |
| `permissions/module-labels.ts` | **Modificar**: `service_entries: 'Entradas de serviço'`. |
| `permissions/menu.ts` | **Modificar**: grupo **Serviços** depois de Financeiro. |
| `routes/router.tsx` | **Modificar**: 4 rotas. |
| `modules/service-entries/service-entries-page.tsx` | Listagem, filtros, menu Ações. |
| `modules/service-entries/service-entry-form-page.tsx` | Rota dedicada: new / edit / view. |
| `modules/service-entries/service-entry-items-section.tsx` | Sub-form + tabela dos serviços. |
| `modules/service-entries/service-entry-status-badge.tsx` | Aberta / Finalizada / Cancelada. |
| `modules/service-entries/finalize-entry-dialog.tsx` | Confirmação com o resumo do parcelamento. |

---

## Task 1: Migrations, models e a coluna de origem em `payables`

**Files:**
- Create: `backend/database/migrations/<timestamp>_create_service_entries_table.ts`
- Create: `backend/database/migrations/<timestamp>_create_service_entry_items_table.ts`
- Create: `backend/database/migrations/<timestamp>_add_service_entry_id_to_payables.ts`
- Create: `backend/app/models/service_entry.ts`
- Create: `backend/app/models/service_entry_item.ts`
- Modify: `backend/app/models/payable.ts`

**Interfaces:**
- Produces: `ServiceEntry` (model, default export de `#models/service_entry`), o tipo `ServiceEntryStatus = 'open' | 'finalized' | 'cancelled'`, a const `SERVICE_ENTRY_STATUSES`, o tipo `TaxWithholding = 'issuer' | 'recipient'`; `ServiceEntryItem` (default export de `#models/service_entry_item`); `Payable.serviceEntryId: number | null`.

- [ ] **Step 1: Gerar os três arquivos de migration**

As migrations rodam na ordem do timestamp do nome, e `payables.service_entry_id` referencia `service_entries` — então **gere nesta ordem**, para que os timestamps fiquem crescentes:

```bash
cd backend
node ace make:migration service_entries
node ace make:migration service_entry_items
node ace make:migration add_service_entry_id_to_payables
```

- [ ] **Step 2: Preencher a migration de `service_entries`**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('company_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('RESTRICT')
      table
        .integer('document_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('document_types')
        .onDelete('RESTRICT')
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('RESTRICT')
      table
        .integer('payment_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payment_types')
        .onDelete('RESTRICT')

      // String, não number: preserva zeros à esquerda e aceita "12345/A".
      table.string('document_number', 20).notNullable()
      table.string('series', 10).nullable()
      table.string('sub_series', 10).nullable()

      // Emissão = data do documento. Operação = data do lançamento no sistema.
      table.date('issue_date').notNullable()
      table.date('operation_date').notNullable()

      // Desconto geral da nota, distinto do desconto por serviço.
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)

      // 'issuer' = retenção pelo emissor (não abate nada do que pagamos).
      // 'recipient' = retenção pelo destinatário (os 6 valores abaixo abatem).
      table.string('tax_withholding', 20).notNullable().defaultTo('issuer')
      table.decimal('iss', 12, 2).notNullable().defaultTo(0)
      table.decimal('pis', 12, 2).notNullable().defaultTo(0)
      table.decimal('cofins', 12, 2).notNullable().defaultTo(0)
      table.decimal('inss', 12, 2).notNullable().defaultTo(0)
      table.decimal('irrf', 12, 2).notNullable().defaultTo(0)
      table.decimal('csll', 12, 2).notNullable().defaultTo(0)

      // Quantidade de parcelas. Em `payables`, `installment` é o ORDINAL da
      // parcela — nomes distintos de propósito.
      table.integer('installment_count').notNullable().defaultTo(1)
      table.date('first_due_date').notNullable()

      // Resultado, nunca escrito pelo usuário.
      table.string('status', 20).notNullable().defaultTo('open')
      table.timestamp('finalized_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'operation_date'], 'service_entries_company_operation_idx')
      table.index(['company_id', 'status'], 'service_entries_company_status_idx')
      table.index(['company_id', 'supplier_id'], 'service_entries_company_supplier_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Preencher a migration de `service_entry_items`**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_entry_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('company_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('RESTRICT')
      // RESTRICT, não CASCADE: o projeto inteiro é RESTRICT, e o service apaga
      // os filhos explicitamente dentro da transação (como o cancelamento de
      // título faz com as baixas).
      table
        .integer('service_entry_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('service_entries')
        .onDelete('RESTRICT')
      table
        .integer('service_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('services')
        .onDelete('RESTRICT')

      // Inteiro: serviço se conta por unidade (decisão do usuário).
      table.integer('quantity').notNullable()
      table.decimal('unit_price', 12, 2).notNullable()
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'service_entry_id'], 'service_entry_items_company_entry_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: Preencher a migration da coluna em `payables`**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payables'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Nullable de propósito: um título pode nascer solto (botão Novo) ou, no
      // futuro, do lançamento direto financeiro — que entrará como sua própria
      // coluna nullable. Uma coluna por origem, sem polimorfismo.
      // RESTRICT é o que impede excluir uma entrada que já gerou título.
      table
        .integer('service_entry_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('service_entries')
        .onDelete('RESTRICT')
      table.index(['service_entry_id'], 'payables_service_entry_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['service_entry_id'], 'payables_service_entry_idx')
      table.dropForeign(['service_entry_id'])
      table.dropColumn('service_entry_id')
    })
  }
}
```

- [ ] **Step 5: Rodar as migrations**

```bash
cd backend && node ace migration:run
```

Esperado: as 3 migrations aplicadas, sem erro. Se `add_service_entry_id_to_payables` falhar com "relation service_entries does not exist", os timestamps saíram fora de ordem — renomeie o arquivo para um timestamp maior que o de `create_service_entries_table` e rode `node ace migration:rollback` até limpar antes de repetir.

- [ ] **Step 6: Criar `backend/app/models/service_entry.ts`**

```ts
import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import DocumentType from '#models/document_type'
import PaymentType from '#models/payment_type'
import Supplier from '#models/supplier'
import ServiceEntryItem from '#models/service_entry_item'

/**
 * Status of a service entry. **A result, never a user choice** — moved only by
 * the finalize and cancel actions. `cancelled` is terminal: there is no reopen.
 */
export type ServiceEntryStatus = 'open' | 'finalized' | 'cancelled'

export const SERVICE_ENTRY_STATUSES = [
  'open',
  'finalized',
  'cancelled',
] as const satisfies readonly ServiceEntryStatus[]

/**
 * Who withholds the taxes. `issuer` means the supplier handles them and nothing
 * is deducted from what we owe; `recipient` means we withhold, so the six tax
 * amounts are subtracted from the payable base.
 */
export type TaxWithholding = 'issuer' | 'recipient'

export const TAX_WITHHOLDINGS = [
  'issuer',
  'recipient',
] as const satisfies readonly TaxWithholding[]

/**
 * Service entry (entrada de serviço) — the incoming service invoice, per
 * company. Hard delete, and only while `open`.
 *
 * All money columns are `decimal(12,2)` in reais; the driver hands them back as
 * strings, so they are consumed through `Number(...)` in the service.
 *
 * See `docs/spec/servicos/001-criar-tela-entrada-de-servico.md`.
 */
export default class ServiceEntry extends BaseModel {
  static table = 'service_entries'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'document_type_id' })
  declare documentTypeId: number

  @column({ columnName: 'supplier_id' })
  declare supplierId: number

  @column({ columnName: 'payment_type_id' })
  declare paymentTypeId: number

  @column({ columnName: 'document_number' })
  declare documentNumber: string

  @column()
  declare series: string | null

  @column({ columnName: 'sub_series' })
  declare subSeries: string | null

  @column.date({ columnName: 'issue_date' })
  declare issueDate: DateTime

  /** When it was entered in the system — not the document's date. */
  @column.date({ columnName: 'operation_date' })
  declare operationDate: DateTime

  /** Invoice-wide discount, distinct from each item's own discount. */
  @column()
  declare discount: number

  @column({ columnName: 'tax_withholding' })
  declare taxWithholding: TaxWithholding

  @column()
  declare iss: number

  @column()
  declare pis: number

  @column()
  declare cofins: number

  @column()
  declare inss: number

  @column()
  declare irrf: number

  @column()
  declare csll: number

  /** How many installments. The ordinal lives in `payables.installment`. */
  @column({ columnName: 'installment_count' })
  declare installmentCount: number

  @column.date({ columnName: 'first_due_date' })
  declare firstDueDate: DateTime

  /** Never set from a payload — see `ServiceEntryService.finalize/cancel`. */
  @column()
  declare status: ServiceEntryStatus

  @column.dateTime({ columnName: 'finalized_at' })
  declare finalizedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => DocumentType)
  declare documentType: BelongsTo<typeof DocumentType>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => PaymentType)
  declare paymentType: BelongsTo<typeof PaymentType>

  @hasMany(() => ServiceEntryItem)
  declare items: HasMany<typeof ServiceEntryItem>
}
```

> Confirme os nomes dos models importados (`#models/document_type`, `#models/payment_type`, `#models/supplier`) e o nome da classe exportada em cada um antes de rodar o typecheck.

- [ ] **Step 7: Criar `backend/app/models/service_entry_item.ts`**

```ts
import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Service from '#models/service'
import ServiceEntry from '#models/service_entry'

/**
 * One service line of a service entry. The line total
 * (`quantity * unitPrice - discount`) is **derived, never stored** — same policy
 * as the payable's `total`.
 */
export default class ServiceEntryItem extends BaseModel {
  static table = 'service_entry_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'service_entry_id' })
  declare serviceEntryId: number

  @column({ columnName: 'service_id' })
  declare serviceId: number

  @column()
  declare quantity: number

  @column({ columnName: 'unit_price' })
  declare unitPrice: number

  @column()
  declare discount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ServiceEntry)
  declare serviceEntry: BelongsTo<typeof ServiceEntry>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>
}
```

- [ ] **Step 8: Adicionar a coluna ao model `Payable`**

Em `backend/app/models/payable.ts`, logo depois de `declare supplierId: number`:

```ts
  /**
   * Origin of this title: the service entry that generated it, or `null` when it
   * was entered by hand. Future origins (lançamento direto financeiro) get their
   * own nullable column — one per origin, no polymorphism.
   */
  @column({ columnName: 'service_entry_id' })
  declare serviceEntryId: number | null
```

- [ ] **Step 9: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 10: Verificar o schema no banco**

```bash
psql "$DATABASE_URL" -c '\d service_entries' -c '\d service_entry_items' -c '\d payables'
```

(ou as credenciais locais do `.env` — `psql -U <user> -d <db>`). Confirme: as 4 FKs de `service_entries`, os 3 índices, `status` default `'open'`, e a coluna `service_entry_id` **nullable** em `payables`.

- [ ] **Step 11: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/database/migrations/*service_entr* backend/database/migrations/*service_entry_id_to_payables* backend/app/models/service_entry.ts backend/app/models/service_entry_item.ts backend/app/models/payable.ts
git commit -m "feat(servicos): schema da entrada de serviço e coluna de origem em payables"
```

---

## Task 2: Permissões (catálogo + rótulo de módulo)

**Files:**
- Modify: `backend/app/abilities/catalog.ts`
- Modify: `frontend/src/permissions/module-labels.ts`

**Interfaces:**
- Produces: os slugs `service_entries.view`, `.create`, `.edit`, `.delete`, `.finalize`, `.cancel` — consumidos pelas rotas (Task 4/6/7) e pelos gates `Can` do frontend (Tasks 9–11).

- [ ] **Step 1: Adicionar as 6 permissões ao catálogo**

Em `backend/app/abilities/catalog.ts`, no array `PERMISSIONS`, **depois** do bloco de `receivable_settlements` (mantenha o agrupamento por comentário que o arquivo já usa):

```ts
  // Service entries
  { slug: 'service_entries.view', name: 'Visualizar entradas de serviço', module: 'service_entries', action: 'view', description: 'Listar e consultar as entradas de serviço da empresa.' },
  { slug: 'service_entries.create', name: 'Criar entrada de serviço', module: 'service_entries', action: 'create', description: 'Lançar novas entradas de nota fiscal de serviço.' },
  { slug: 'service_entries.edit', name: 'Editar entrada de serviço', module: 'service_entries', action: 'edit', description: 'Alterar entradas de serviço ainda abertas.' },
  { slug: 'service_entries.delete', name: 'Excluir entrada de serviço', module: 'service_entries', action: 'delete', description: 'Remover entradas de serviço ainda abertas.' },
  { slug: 'service_entries.finalize', name: 'Finalizar entrada de serviço', module: 'service_entries', action: 'finalize', description: 'Finalizar a entrada e gerar os títulos a pagar correspondentes.' },
  { slug: 'service_entries.cancel', name: 'Cancelar entrada de serviço', module: 'service_entries', action: 'cancel', description: 'Cancelar a entrada e todos os títulos a pagar que ela gerou.' },
```

`finalize` e `cancel` são permissões **separadas de `edit`** de propósito: finalizar gera dinheiro no contas a pagar e cancelar apaga baixas — não é o mesmo poder que corrigir um rascunho.

- [ ] **Step 2: Adicionar o rótulo do módulo**

Em `frontend/src/permissions/module-labels.ts`, seguindo a ordem/formatação do arquivo:

```ts
  service_entries: 'Entradas de serviço',
```

Padrão do rótulo: pt-BR capitalizado (só a inicial maiúscula), plural. **Sem esta linha**, as telas de Permissões/Perfis/Usuários mostram o slug cru `service_entries`.

- [ ] **Step 3: Rodar o seed**

```bash
cd backend && node ace db:seed
```

O seeder é idempotente — pode rodar sobre a base existente.

- [ ] **Step 4: Verificar que as permissões entraram**

```bash
psql "$DATABASE_URL" -c "select slug, name from permissions where module = 'service_entries' order by slug;"
```

Expected: exatamente 6 linhas, com os `name` em português.

- [ ] **Step 5: Typecheck dos dois lados**

```bash
cd backend && npm run typecheck
cd ../frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/abilities/catalog.ts frontend/src/permissions/module-labels.ts
git commit -m "feat(servicos): permissões da entrada de serviço (view/create/edit/delete/finalize/cancel)"
```

---

## Task 3: Funções puras de parcelamento

**Files:**
- Create: `backend/app/utils/installments.ts`

**Interfaces:**
- Produces:
  - `splitInstallments(baseCents: number, count: number): number[]` — devolve `count` valores **em centavos**, cuja soma é exatamente `baseCents`.
  - `installmentDueDates(firstDue: DateTime, count: number): DateTime[]` — devolve `count` datas, uma por mês a partir de `firstDue`.
- Consumed by: `ServiceEntryService.finalize` (Task 6).

- [ ] **Step 1: Criar `backend/app/utils/installments.ts`**

```ts
import { DateTime } from 'luxon'

/**
 * Splits an amount **in cents** into `count` installments.
 *
 * The first installments are equal and the **remainder goes to the last one**,
 * so the parts always add back up to exactly `baseCents` — splitting R$ 1.000,00
 * in 3 yields 333,33 + 333,33 + **333,34**, never 999,99.
 *
 * Works in integer cents on purpose: dividing reais as floats would leave the
 * sum off by fractions of a cent, and the payables would not match the invoice.
 *
 * Callers must ensure `count >= 1` and `baseCents >= count` (otherwise an
 * installment would be R$ 0,00) — `ServiceEntryService.finalize` validates both
 * and answers 422.
 */
export function splitInstallments(baseCents: number, count: number): number[] {
  const base = Math.trunc(baseCents)
  const per = Math.floor(base / count)
  const remainder = base - per * count

  const parts = Array.from({ length: count }, () => per)
  parts[count - 1] += remainder
  return parts
}

/**
 * Due date of each installment: the **same day of each following month**, not
 * "+30 days" — 30 days would drag the due date backwards through the calendar
 * (05/10 + 30 = 04/11) instead of holding the agreed day.
 *
 * Luxon clamps a day that does not exist in the target month, so 31/01 + 1 month
 * is 28/02 (or 29/02 on a leap year).
 */
export function installmentDueDates(firstDue: DateTime, count: number): DateTime[] {
  return Array.from({ length: count }, (_, index) => firstDue.plus({ months: index }))
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Exercitar as duas funções**

O backend usa aliases (`#utils/*`), então rode via `node ace repl`:

```bash
cd backend && node ace repl
```

No prompt:

```js
const { splitInstallments, installmentDueDates } = await import('#utils/installments')
const { DateTime } = await import('luxon')

splitInstallments(100000, 3)                       // [33333, 33333, 33334]
splitInstallments(100000, 3).reduce((a,b)=>a+b, 0) // 100000
splitInstallments(897000, 4)                       // [224250, 224250, 224250, 224250]
splitInstallments(1000, 1)                         // [1000]
splitInstallments(5, 5)                            // [1, 1, 1, 1, 1]

installmentDueDates(DateTime.fromISO('2026-09-05'), 4).map(d => d.toISODate())
// ['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05']
installmentDueDates(DateTime.fromISO('2026-01-31'), 3).map(d => d.toISODate())
// ['2026-01-31', '2026-02-28', '2026-03-31']
```

Expected: exatamente os valores comentados. Confira **em especial** que a soma de `splitInstallments` bate com a base em todos os casos e que 31/01 vira 28/02.

- [ ] **Step 4: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/utils/installments.ts
git commit -m "feat(servicos): funções puras de rateio de parcelas e vencimentos mensais"
```

---

## Task 4: Repository, validators, service (CRUD) e controller

Só o CRUD — `finalize` e `cancel` vêm nas Tasks 6 e 7.

**Files:**
- Create: `backend/app/repositories/service_entry_repository.ts`
- Create: `backend/app/validators/service_entry_validators.ts`
- Create: `backend/app/services/service_entry_service.ts`
- Create: `backend/app/controllers/service_entries_controller.ts`
- Modify: `backend/start/routes.ts`

**Interfaces:**
- Consumes: `ServiceEntry`, `ServiceEntryItem`, `SERVICE_ENTRY_STATUSES`, `TaxWithholding` (Task 1); os slugs de permissão (Task 2).
- Produces:
  - `serviceEntryRepository.query(companyId)`, `.findById(companyId, id)`
  - `serviceEntryService.list/show/create/update/destroy`
  - `serviceEntryService.itemsTotalCents(items)`, `.withheldTaxCents(entry)`, `.baseCents(entry, items)` — usados pelo `finalize` na Task 6
  - `createServiceEntryValidator`, `updateServiceEntryValidator`
  - endpoints `GET|POST /api/service-entries`, `GET|PUT|DELETE /api/service-entries/:id`

- [ ] **Step 1: Criar o repository**

`backend/app/repositories/service_entry_repository.ts` — espelha `payable_repository.ts`:

```ts
import ServiceEntry from '#models/service_entry'

/**
 * Data access for service entries. Always scoped by company — callers must pass
 * the active tenant's company id.
 */
export class ServiceEntryRepository {
  query(companyId: number) {
    return ServiceEntry.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ServiceEntryRepository()
```

- [ ] **Step 2: Criar os validators**

`backend/app/validators/service_entry_validators.ts`:

```ts
import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Service Entries module.
 *
 * **`status`, `finalizedAt` and `operationDate` are absent on purpose.** They
 * are results, not input: the first two move only through the finalize/cancel
 * actions, and `operationDate` is stamped by the service with the application's
 * "today". VineJS drops unknown keys, so a payload carrying them is silently
 * ignored rather than rejected.
 *
 * Cross-field rules (discount <= total, base > 0, firstDueDate >= issueDate)
 * live in the service — they need more than one field, or the persisted state,
 * to decide.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',

  'documentTypeId.required': 'Selecione o tipo de documento.',
  'documentTypeId.min': 'Selecione o tipo de documento.',

  'documentNumber.required': 'Número do documento é obrigatório.',
  'documentNumber.minLength': 'Número do documento é obrigatório.',
  'documentNumber.maxLength': 'Número do documento deve ter no máximo 20 caracteres.',

  'series.maxLength': 'Série deve ter no máximo 10 caracteres.',
  'subSeries.maxLength': 'Sub-série deve ter no máximo 10 caracteres.',

  'issueDate.required': 'Data de emissão é obrigatória.',
  'issueDate.date': 'Data de emissão inválida.',

  'supplierId.required': 'Selecione um fornecedor.',
  'supplierId.min': 'Selecione um fornecedor.',

  'discount.min': 'Desconto não pode ser negativo.',
  'taxWithholding.enum': 'Selecione quem retém o imposto.',
  'iss.min': 'ISS não pode ser negativo.',
  'pis.min': 'PIS não pode ser negativo.',
  'cofins.min': 'COFINS não pode ser negativo.',
  'inss.min': 'INSS não pode ser negativo.',
  'irrf.min': 'IRRF não pode ser negativo.',
  'csll.min': 'CSLL não pode ser negativo.',

  'paymentTypeId.required': 'Selecione o tipo de pagamento.',
  'paymentTypeId.min': 'Selecione o tipo de pagamento.',

  'installmentCount.required': 'Quantidade de parcelas é obrigatória.',
  'installmentCount.min': 'Quantidade de parcelas deve ser no mínimo 1.',
  'installmentCount.max': 'Quantidade de parcelas deve ser no máximo 999.',

  'firstDueDate.required': 'Primeiro vencimento é obrigatório.',
  'firstDueDate.date': 'Primeiro vencimento inválido.',

  'items.required': 'Adicione ao menos um serviço.',
  'items.minLength': 'Adicione ao menos um serviço.',
  'items.*.serviceId.required': 'Selecione o serviço.',
  'items.*.serviceId.min': 'Selecione o serviço.',
  'items.*.quantity.min': 'Quantidade deve ser no mínimo 1.',
  'items.*.unitPrice.min': 'Valor do serviço deve ser maior que zero.',
  'items.*.discount.min': 'Desconto do serviço não pode ser negativo.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

const itemSchema = vine.object({
  serviceId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  // `min(0.01)`: money with 2 decimals, so the smallest valid price is one cent.
  unitPrice: vine.number().min(0.01),
  discount: vine.number().min(0).optional(),
})

const taxFields = {
  discount: vine.number().min(0).optional(),
  taxWithholding: vine.enum(['issuer', 'recipient'] as const).optional(),
  iss: vine.number().min(0).optional(),
  pis: vine.number().min(0).optional(),
  cofins: vine.number().min(0).optional(),
  inss: vine.number().min(0).optional(),
  irrf: vine.number().min(0).optional(),
  csll: vine.number().min(0).optional(),
}

export const createServiceEntryValidator = vine.compile(
  vine.object({
    documentTypeId: vine.number().withoutDecimals().min(1),
    documentNumber: vine.string().trim().minLength(1).maxLength(20),
    series: vine.string().trim().maxLength(10).optional(),
    subSeries: vine.string().trim().maxLength(10).optional(),
    issueDate: vine.date(DATE_FORMAT),
    supplierId: vine.number().withoutDecimals().min(1),
    ...taxFields,
    paymentTypeId: vine.number().withoutDecimals().min(1),
    installmentCount: vine.number().withoutDecimals().min(1).max(999),
    firstDueDate: vine.date(DATE_FORMAT),
    items: vine.array(itemSchema).minLength(1),
  })
)
createServiceEntryValidator.messagesProvider = messages

export const updateServiceEntryValidator = vine.compile(
  vine.object({
    documentTypeId: vine.number().withoutDecimals().min(1),
    documentNumber: vine.string().trim().minLength(1).maxLength(20),
    series: vine.string().trim().maxLength(10).optional(),
    subSeries: vine.string().trim().maxLength(10).optional(),
    issueDate: vine.date(DATE_FORMAT),
    supplierId: vine.number().withoutDecimals().min(1),
    ...taxFields,
    paymentTypeId: vine.number().withoutDecimals().min(1),
    installmentCount: vine.number().withoutDecimals().min(1).max(999),
    firstDueDate: vine.date(DATE_FORMAT),
    items: vine.array(itemSchema).minLength(1),
  })
)
updateServiceEntryValidator.messagesProvider = messages
```

> **Atenção:** o update **não** é `Partial` como o de payables. Os itens são substituídos **em bloco**, e um PUT parcial deixaria ambíguo se "sem `items`" significa "não mexa" ou "apague todos". Exigir o payload inteiro elimina a ambiguidade — o formulário sempre manda tudo.

- [ ] **Step 3: Criar o service (CRUD)**

`backend/app/services/service_entry_service.ts`:

```ts
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ServiceEntry, { type ServiceEntryStatus, type TaxWithholding } from '#models/service_entry'
import ServiceEntryItem from '#models/service_entry_item'
import Service from '#models/service'
import type { TenantContext } from '#services/tenant_context'
import serviceEntryRepository from '#repositories/service_entry_repository'
import supplierRepository from '#repositories/supplier_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'

export interface ListParams {
  documentNumber?: string
  supplierId?: number
  operationFrom?: string
  operationTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Vazio/ausente = **todos**. */
  statuses?: ServiceEntryStatus[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  document_number: 'document_number',
  issue_date: 'issue_date',
  operation_date: 'operation_date',
  status: 'status',
}

export interface ServiceEntryItemDTO {
  serviceId: number
  quantity: number
  unitPrice: number
  discount?: number
}

export interface CreateServiceEntryDTO {
  documentTypeId: number
  documentNumber: string
  series?: string
  subSeries?: string
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  issueDate: Date
  supplierId: number
  discount?: number
  taxWithholding?: TaxWithholding
  iss?: number
  pis?: number
  cofins?: number
  inss?: number
  irrf?: number
  csll?: number
  paymentTypeId: number
  installmentCount: number
  firstDueDate: Date
  items: ServiceEntryItemDTO[]
}

export type UpdateServiceEntryDTO = CreateServiceEntryDTO

export class ServiceEntryService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'

    const query = serviceEntryRepository
      .query(tenant.company.id)
      .preload('supplier')
      .preload('documentType')
      // Σ dos filhos como coluna computada. Subquery e não join+group by: o
      // paginate do Lucid conta linhas, e um join com N itens multiplicaria o
      // total da paginação.
      .select('service_entries.*')
      .select(
        db.raw(
          `(select coalesce(sum(quantity * unit_price - discount), 0)
              from service_entry_items
             where service_entry_items.service_entry_id = service_entries.id) as items_total`
        )
      )

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    if (sortColumn) query.orderBy(sortColumn, direction)
    else query.orderBy('operation_date', 'desc').orderBy('id', 'desc')

    if (params.documentNumber) {
      const term = `%${params.documentNumber.toLowerCase()}%`
      query.whereRaw('lower(document_number) like ?', [term])
    }
    if (params.supplierId) query.where('supplier_id', params.supplierId)
    if (params.operationFrom) query.where('operation_date', '>=', params.operationFrom)
    if (params.operationTo) query.where('operation_date', '<=', params.operationTo)
    if (params.issueFrom) query.where('issue_date', '>=', params.issueFrom)
    if (params.issueTo) query.where('issue_date', '<=', params.issueTo)
    if (params.statuses && params.statuses.length > 0) query.whereIn('status', params.statuses)

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((row) => this.serialize(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  async show(tenant: TenantContext, id: number) {
    const row = await this.findOrFail(tenant, id)
    await row.load('supplier')
    await row.load('documentType')
    await row.load('paymentType')
    const items = await this.loadItems(tenant, row.id)
    return this.serialize(row, items)
  }

  async create(tenant: TenantContext, dto: CreateServiceEntryDTO) {
    return db.transaction(async (trx) => {
      await this.assertRelations(tenant, dto)

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, issueDate, firstDueDate)

      const row = new ServiceEntry()
      row.merge({
        companyId: tenant.company.id,
        ...this.headerValues(dto),
        issueDate,
        firstDueDate,
        // Data do lançamento no sistema — do backend, no fuso da aplicação.
        operationDate: DateTime.fromISO(todayIso()),
        status: 'open',
        finalizedAt: null,
      })
      row.useTransaction(trx)
      await row.save()

      await this.replaceItems(tenant, row.id, dto.items, trx)

      return row.id
    }).then((id) => this.show(tenant, id))
  }

  async update(tenant: TenantContext, id: number, dto: UpdateServiceEntryDTO) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível editar uma entrada finalizada ou cancelada.'
        )
      }

      await this.assertRelations(tenant, dto)

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, issueDate, firstDueDate)

      row.merge({ ...this.headerValues(dto), issueDate, firstDueDate })
      row.useTransaction(trx)
      await row.save()

      // Substituição em bloco: apaga todos e reinsere. Evita ter que diferenciar
      // item novo/alterado/removido no cliente.
      await this.replaceItems(tenant, row.id, dto.items, trx)
    })

    return this.show(tenant, id)
  }

  async destroy(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível excluir uma entrada finalizada ou cancelada.'
        )
      }

      await ServiceEntryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
        .delete()

      try {
        row.useTransaction(trx)
        await row.delete()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'Não é possível excluir esta entrada porque ela já gerou títulos a pagar.'
          )
        }
        throw error
      }
    })
  }

  // ---------------------------------------------------------------- a conta

  /** Σ (quantidade × valor − desconto) de cada item, em centavos. */
  itemsTotalCents(items: ServiceEntryItem[]): number {
    return items.reduce(
      (sum, item) =>
        sum + this.cents(item.unitPrice) * Number(item.quantity) - this.cents(item.discount),
      0
    )
  }

  /**
   * Impostos que abatem o que pagamos. Retenção pelo **emissor** não abate nada
   * — quem recolhe é o fornecedor, e o valor cheio da nota continua devido.
   */
  withheldTaxCents(entry: ServiceEntry): number {
    if (entry.taxWithholding !== 'recipient') return 0
    return (
      this.cents(entry.iss) +
      this.cents(entry.pis) +
      this.cents(entry.cofins) +
      this.cents(entry.inss) +
      this.cents(entry.irrf) +
      this.cents(entry.csll)
    )
  }

  /** O valor que vira contas a pagar, em centavos. */
  baseCents(entry: ServiceEntry, items: ServiceEntryItem[]): number {
    return this.itemsTotalCents(items) - this.cents(entry.discount) - this.withheldTaxCents(entry)
  }

  // ------------------------------------------------------------- internos

  async loadItems(tenant: TenantContext, entryId: number) {
    return ServiceEntryItem.query()
      .where('company_id', tenant.company.id)
      .where('service_entry_id', entryId)
      .preload('service')
      .orderBy('id', 'asc')
  }

  async findOrFail(tenant: TenantContext, id: number) {
    const row = await serviceEntryRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Entrada de serviço não encontrada.')
    return row
  }

  /** Carrega com lock da linha — serializa finalizações concorrentes. */
  async lock(tenant: TenantContext, id: number, trx: TransactionClientContract) {
    const row = await ServiceEntry.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', id)
      .forUpdate()
      .first()
    if (!row) throw new NotFoundException('Entrada de serviço não encontrada.')
    return row
  }

  private headerValues(dto: CreateServiceEntryDTO) {
    const withholding: TaxWithholding = dto.taxWithholding ?? 'issuer'
    // Retenção pelo emissor zera os impostos AQUI, não na UI: o service não
    // confia no payload.
    const tax = (value: number | undefined) => (withholding === 'recipient' ? (value ?? 0) : 0)

    return {
      documentTypeId: dto.documentTypeId,
      supplierId: dto.supplierId,
      paymentTypeId: dto.paymentTypeId,
      documentNumber: dto.documentNumber,
      series: dto.series || null,
      subSeries: dto.subSeries || null,
      discount: dto.discount ?? 0,
      taxWithholding: withholding,
      iss: tax(dto.iss),
      pis: tax(dto.pis),
      cofins: tax(dto.cofins),
      inss: tax(dto.inss),
      irrf: tax(dto.irrf),
      csll: tax(dto.csll),
      installmentCount: dto.installmentCount,
    }
  }

  private async replaceItems(
    tenant: TenantContext,
    entryId: number,
    items: ServiceEntryItemDTO[],
    trx: TransactionClientContract
  ) {
    await ServiceEntryItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('service_entry_id', entryId)
      .delete()

    await ServiceEntryItem.createMany(
      items.map((item) => ({
        companyId: tenant.company.id,
        serviceEntryId: entryId,
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
      })),
      { client: trx }
    )
  }

  private async assertRelations(tenant: TenantContext, dto: CreateServiceEntryDTO) {
    const supplier = await supplierRepository.findById(tenant.company.id, dto.supplierId)
    // Mesma mensagem exista ou não em outra empresa — não vazamos a existência
    // de dado de outro tenant.
    if (!supplier) throw new BusinessException('Fornecedor inválido.')

    const documentType = await db
      .from('document_types')
      .where('company_id', tenant.company.id)
      .where('id', dto.documentTypeId)
      .first()
    if (!documentType) throw new BusinessException('Tipo de documento inválido.')

    const paymentType = await db
      .from('payment_types')
      .where('company_id', tenant.company.id)
      .where('id', dto.paymentTypeId)
      .first()
    if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')

    const serviceIds = [...new Set(dto.items.map((item) => item.serviceId))]
    const found = await Service.query()
      .where('company_id', tenant.company.id)
      .whereIn('id', serviceIds)
    if (found.length !== serviceIds.length) {
      throw new BusinessException('Serviço inválido.')
    }
  }

  private assertConsistent(
    dto: CreateServiceEntryDTO,
    issueDate: DateTime,
    firstDueDate: DateTime
  ) {
    for (const item of dto.items) {
      const line = this.cents(item.unitPrice) * item.quantity
      if (this.cents(item.discount ?? 0) > line) {
        throw new BusinessException(
          'O desconto de um serviço não pode ser maior que o valor da linha.'
        )
      }
    }

    const itemsTotal = dto.items.reduce(
      (sum, item) =>
        sum + this.cents(item.unitPrice) * item.quantity - this.cents(item.discount ?? 0),
      0
    )
    if (this.cents(dto.discount ?? 0) > itemsTotal) {
      throw new BusinessException('O desconto da nota não pode ser maior que o total dos serviços.')
    }

    if (firstDueDate.toISODate()! < issueDate.toISODate()!) {
      throw new BusinessException('O 1º vencimento não pode ser anterior à emissão.')
    }
  }

  /**
   * Money in cents. `decimal` columns come back from the driver as strings, and
   * floating-point reais would make the installment split lose fractions of a
   * cent. Integer cents divide exactly.
   */
  private cents(value: number | string | null | undefined): number {
    return Math.round(Number(value ?? 0) * 100)
  }

  serialize(row: ServiceEntry, items?: ServiceEntryItem[]) {
    // `items_total` vem da subquery no list; no show, soma os itens carregados.
    const itemsTotalCents =
      items !== undefined
        ? this.itemsTotalCents(items)
        : this.cents((row.$extras as { items_total?: string }).items_total ?? 0)

    const withheldCents = this.withheldTaxCents(row)
    const netCents = itemsTotalCents - this.cents(row.discount) - withheldCents

    return {
      id: row.id,
      documentTypeId: row.documentTypeId,
      documentTypeName: row.documentType?.description ?? null,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      paymentTypeId: row.paymentTypeId,
      paymentTypeName: row.paymentType?.description ?? null,
      documentNumber: row.documentNumber,
      series: row.series,
      subSeries: row.subSeries,
      issueDate: row.issueDate.toISODate(),
      operationDate: row.operationDate.toISODate(),
      discount: Number(row.discount),
      taxWithholding: row.taxWithholding,
      iss: Number(row.iss),
      pis: Number(row.pis),
      cofins: Number(row.cofins),
      inss: Number(row.inss),
      irrf: Number(row.irrf),
      csll: Number(row.csll),
      installmentCount: row.installmentCount,
      firstDueDate: row.firstDueDate.toISODate(),
      status: row.status,
      finalizedAt: row.finalizedAt?.toISO() ?? null,
      itemsTotal: itemsTotalCents / 100,
      withheldTaxes: withheldCents / 100,
      netAmount: netCents / 100,
      items: items?.map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        serviceDescription: item.service?.description ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        lineTotal:
          (this.cents(item.unitPrice) * Number(item.quantity) - this.cents(item.discount)) / 100,
      })),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ServiceEntryService()
```

> **Confirme os nomes das colunas de exibição** antes do typecheck: o plano assume `documentType.description`, `paymentType.description` e `service.description`, e `supplier.name`. Se algum model usar outro nome, ajuste no `serialize`.
>
> O tipo `TransactionClientContract` é o mesmo que `payable_settlement_service.ts` já usa para receber a transação do chamador — confira lá se o caminho do import bate.

- [ ] **Step 4: Criar o controller**

`backend/app/controllers/service_entries_controller.ts` — espelha `payables_controller.ts`:

```ts
import { HttpContext } from '@adonisjs/core/http'
import serviceEntryService from '#services/service_entry_service'
import { SERVICE_ENTRY_STATUSES, type ServiceEntryStatus } from '#models/service_entry'
import {
  createServiceEntryValidator,
  updateServiceEntryValidator,
} from '#validators/service_entry_validators'

const VALID_STATUSES: readonly string[] = SERVICE_ENTRY_STATUSES

/**
 * Status filter — **multiple choice**. Nothing selected means *all*.
 *
 * Accepts both shapes: `?status=open` arrives as a string, while
 * `?status=open,finalized` is already split into an array by the query-string
 * parser (and axios sends the comma unescaped). Unknown values are dropped
 * rather than rejected — a stale bookmark should not 422.
 */
function parseStatuses(raw: unknown): ServiceEntryStatus[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_STATUSES.includes(part)) as ServiceEntryStatus[]

  return statuses.length > 0 ? statuses : undefined
}

export default class ServiceEntriesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'
    return serviceEntryService.list(tenant, {
      documentNumber: request.input('documentNumber') || undefined,
      supplierId: request.input('supplierId') ? Number(request.input('supplierId')) : undefined,
      operationFrom: request.input('operationFrom') || undefined,
      operationTo: request.input('operationTo') || undefined,
      issueFrom: request.input('issueFrom') || undefined,
      issueTo: request.input('issueTo') || undefined,
      statuses: parseStatuses(request.input('status')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return serviceEntryService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createServiceEntryValidator)
    const row = await serviceEntryService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateServiceEntryValidator)
    return serviceEntryService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await serviceEntryService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
```

- [ ] **Step 5: Registrar as rotas**

Em `backend/start/routes.ts`, adicione o import junto dos outros controllers (perto da linha 40):

```ts
const ServiceEntriesController = () => import('#controllers/service_entries_controller')
```

E, **depois** do bloco de contas a receber (o último do financeiro), dentro do mesmo grupo autenticado + tenant:

```ts
    // Entrada de serviço (módulo Serviços)
    router
      .get('/service-entries', [ServiceEntriesController, 'index'])
      .use(middleware.permission('service_entries.view'))
    router
      .post('/service-entries', [ServiceEntriesController, 'store'])
      .use(middleware.permission('service_entries.create'))
    router
      .get('/service-entries/:id', [ServiceEntriesController, 'show'])
      .use(middleware.permission('service_entries.view'))
    router
      .put('/service-entries/:id', [ServiceEntriesController, 'update'])
      .use(middleware.permission('service_entries.edit'))
    router
      .delete('/service-entries/:id', [ServiceEntriesController, 'destroy'])
      .use(middleware.permission('service_entries.delete'))
```

Não há aqui o problema de ordem que `payables` teve com `/batch-settlements`: não existe rota literal nesta família que `/:id` pudesse capturar.

- [ ] **Step 6: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 7: Criar o harness de verificação**

Crie `/tmp/claude-1000/mpmweb-verify/api.mjs` com o conteúdo da seção *Harness de verificação* no topo deste plano. Antes de seguir, confirme o shape do login:

```bash
cd /tmp/claude-1000/mpmweb-verify
node -e "
const r = await fetch('http://localhost:3333/api/auth/login', {
  method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({email:'carlossantana.desenv@gmail.com', password:'12345678'})
});
console.log(r.status, JSON.stringify(await r.json(), null, 1).slice(0, 600))
"
```

Ajuste `api.mjs` se os nomes dos campos diferirem.

- [ ] **Step 8: Verificar o CRUD**

O backend precisa estar rodando. Crie e execute:

```bash
cat > /tmp/claude-1000/mpmweb-verify/crud.mjs <<'EOF'
import { login, api, check } from './api.mjs'
const h = await login()

// Pré-requisitos: pegue ids reais do tenant.
const dt = (await api(h, 'GET', '/document-types?perPage=1')).body
const pt = (await api(h, 'GET', '/payment-types?perPage=1')).body
const sup = (await api(h, 'GET', '/suppliers?perPage=1')).body
const srv = (await api(h, 'GET', '/services?perPage=1')).body
const documentTypeId = dt.data[0].id
const paymentTypeId = pt.data[0].id
const supplierId = sup.data[0].id
const serviceId = srv.data[0].id

const payload = {
  documentTypeId, supplierId, paymentTypeId,
  documentNumber: 'VERIF-001', series: '41', subSeries: null,
  issueDate: '2026-08-16', firstDueDate: '2026-09-05',
  discount: 0, taxWithholding: 'recipient',
  iss: 5, pis: 5, cofins: 5, inss: 5, irrf: 5, csll: 5,
  installmentCount: 4,
  items: [{ serviceId, quantity: 1, unitPrice: 9000, discount: 0 }],
}

const created = await api(h, 'POST', '/service-entries', payload)
check('create → 201', created.status === 201, created)
const id = created.body?.id
check('nasce aberta', created.body?.status === 'open', created.body?.status)
check('itemsTotal = 9000', created.body?.itemsTotal === 9000, created.body?.itemsTotal)
check('withheldTaxes = 30', created.body?.withheldTaxes === 30, created.body?.withheldTaxes)
check('netAmount = 8970', created.body?.netAmount === 8970, created.body?.netAmount)
check('operationDate = hoje (backend)', typeof created.body?.operationDate === 'string', created.body?.operationDate)

// Retenção pelo emissor zera os impostos no backend, mesmo vindo no payload.
const issuer = await api(h, 'POST', '/service-entries', { ...payload, taxWithholding: 'issuer', documentNumber: 'VERIF-002' })
check('emissor zera os impostos', issuer.body?.withheldTaxes === 0, issuer.body)
check('emissor: net = total', issuer.body?.netAmount === 9000, issuer.body?.netAmount)

// Sem itens → 422.
const noItems = await api(h, 'POST', '/service-entries', { ...payload, documentNumber: 'X', items: [] })
check('sem serviço → 422', noItems.status === 422, noItems.status)

// Vencimento antes da emissão → 422.
const badDue = await api(h, 'POST', '/service-entries', { ...payload, documentNumber: 'X', firstDueDate: '2026-08-01' })
check('1º vencimento < emissão → 422', badDue.status === 422, badDue.body)

// Update substitui os itens em bloco.
const upd = await api(h, 'PUT', `/service-entries/${id}`, {
  ...payload,
  items: [
    { serviceId, quantity: 2, unitPrice: 1000, discount: 0 },
    { serviceId, quantity: 1, unitPrice: 500, discount: 100 },
  ],
})
check('update → 200', upd.status === 200, upd.status)
check('itens substituídos (2 linhas)', upd.body?.items?.length === 2, upd.body?.items)
check('itemsTotal = 2400', upd.body?.itemsTotal === 2400, upd.body?.itemsTotal)

// Listagem traz itemsTotal via subquery.
const list = await api(h, 'GET', '/service-entries?perPage=50')
const found = list.body?.data?.find((e) => e.id === id)
check('list traz a entrada', Boolean(found), list.status)
check('list.itemsTotal = 2400', found?.itemsTotal === 2400, found?.itemsTotal)

// Limpeza.
check('delete → 204', (await api(h, 'DELETE', `/service-entries/${id}`)).status === 204)
check('delete #2 → 204', (await api(h, 'DELETE', `/service-entries/${issuer.body.id}`)).status === 204)
EOF
node /tmp/claude-1000/mpmweb-verify/crud.mjs
```

Expected: todas as linhas `ok`, nenhuma `FAIL`.

- [ ] **Step 9: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/repositories/service_entry_repository.ts backend/app/validators/service_entry_validators.ts backend/app/services/service_entry_service.ts backend/app/controllers/service_entries_controller.ts backend/start/routes.ts
git commit -m "feat(servicos): CRUD da entrada de serviço (cabeçalho + itens em bloco)"
```

---

## Task 5: Pontos de extensão no financeiro

Dois métodos novos em serviços que já existem, para que a Task 6 não recrie regra de título nem de baixa.

**Files:**
- Modify: `backend/app/services/payable_service.ts`
- Modify: `backend/app/services/payable_settlement_service.ts`

**Interfaces:**
- Produces:
  - `payableService.createFromSource(tenant, dto: CreatePayableFromSourceDTO, trx): Promise<Payable>`
  - `payableSettlementService.settleFullInTransaction(tenant, payable, paymentTypeId, settlementDate, notes, trx): Promise<void>`
- Consumed by: `ServiceEntryService.finalize` (Task 6).

- [ ] **Step 1: Adicionar `createFromSource` ao `PayableService`**

Em `backend/app/services/payable_service.ts`, depois do método `create`:

```ts
  /**
   * Creates a payable **on behalf of another module** (today: the service entry;
   * tomorrow: the lançamento direto financeiro), inside the caller's
   * transaction.
   *
   * Exists so the title keeps a single owner: the supplier check, the
   * consistency rules and `recomputeStatus` stay here instead of being rebuilt
   * by every module that generates titles.
   */
  async createFromSource(
    tenant: TenantContext,
    dto: CreatePayableFromSourceDTO,
    trx: TransactionClientContract
  ): Promise<Payable> {
    await this.assertSupplierBelongsToTenant(tenant, dto.supplierId)

    this.assertConsistent({
      amount: dto.amount,
      discount: 0,
      issueDate: dto.issueDate.toISODate()!,
      dueDate: dto.dueDate.toISODate()!,
    })

    const row = new Payable()
    row.merge({
      companyId: tenant.company.id,
      supplierId: dto.supplierId,
      serviceEntryId: dto.serviceEntryId ?? null,
      documentNumber: dto.documentNumber,
      installment: dto.installment,
      issueDate: dto.issueDate,
      dueDate: dto.dueDate,
      amount: dto.amount,
      discount: 0,
      fine: 0,
      interest: 0,
      paidAmount: 0,
      notes: dto.notes ?? null,
    })

    // Sem baixas, nasce `open`. Nunca vem do payload.
    this.recomputeStatus(row)
    row.useTransaction(trx)
    await row.save()

    return row
  }
```

E o DTO, junto dos outros no topo do arquivo:

```ts
/**
 * A payable generated by another module. Unlike `CreatePayableDTO`, dates are
 * already luxon `DateTime` (the caller computed them) and there is no
 * discount/fine/interest — those belong to a hand-entered title.
 */
export interface CreatePayableFromSourceDTO {
  supplierId: number
  documentNumber: string
  installment: number
  issueDate: DateTime
  dueDate: DateTime
  amount: number
  notes?: string | null
  serviceEntryId?: number | null
}
```

Adicione o import do tipo de transação no topo:

```ts
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
```

- [ ] **Step 2: Adicionar `settleFullInTransaction` ao `PayableSettlementService`**

Em `backend/app/services/payable_settlement_service.ts`, como método público. Ele é o `batchCreate` reduzido a um título já travado pelo chamador:

```ts
  /**
   * Settles a payable **in full**, inside the caller's transaction. Used by the
   * automatic settlement of a payment type flagged `auto_settlement` — the
   * payable was just created by the same transaction, so it has no other
   * settlements and its balance is its total.
   *
   * The status still moves through the usual owners (`applySettlement` →
   * `recomputeStatus`); nothing here reimplements the settlement rules.
   */
  async settleFullInTransaction(
    tenant: TenantContext,
    payable: Payable,
    paymentTypeId: number,
    settlementDate: DateTime,
    notes: string | null,
    trx: TransactionClientContract
  ): Promise<void> {
    const amount = payableService.remainingBalance(payable, Number(payable.paidAmount))
    if (amount <= 0) return

    // Valida (Σ ≤ total) e recalcula o status na memória. Fecha em Pago.
    payableService.applySettlement(payable, Number(payable.paidAmount), amount)

    await PayableSettlement.create(
      {
        companyId: tenant.company.id,
        payableId: payable.id,
        paymentTypeId,
        settlementDate,
        amount,
        documentNumber: null,
        notes,
      },
      { client: trx }
    )

    payable.useTransaction(trx)
    await payable.save()
  }
```

Confira os imports do arquivo — `Payable`, `DateTime`, `TransactionClientContract` e `TenantContext` podem já estar lá.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Verificar que nada do financeiro regrediu**

Os dois métodos ainda não têm chamador; o que precisa ser garantido é que contas a pagar continua funcionando. Rode:

```bash
cat > /tmp/claude-1000/mpmweb-verify/payables-smoke.mjs <<'EOF'
import { login, api, check } from './api.mjs'
const h = await login()
const sup = (await api(h, 'GET', '/suppliers?perPage=1')).body
const created = await api(h, 'POST', '/payables', {
  documentNumber: 'SMOKE-1', installment: 1, supplierId: sup.data[0].id,
  issueDate: '2026-08-16', dueDate: '2026-09-16', amount: 100,
})
check('payable create → 201', created.status === 201, created)
check('serviceEntryId = null', created.body?.serviceEntryId === null || created.body?.serviceEntryId === undefined, created.body?.serviceEntryId)
check('nasce aberto', created.body?.status === 'open', created.body?.status)
check('cleanup', (await api(h, 'DELETE', `/payables/${created.body.id}`)).status === 204)
EOF
node /tmp/claude-1000/mpmweb-verify/payables-smoke.mjs
```

Expected: todas `ok`. Um título criado à mão continua nascendo com origem vazia.

- [ ] **Step 5: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/services/payable_service.ts backend/app/services/payable_settlement_service.ts
git commit -m "feat(financeiro): createFromSource e settleFullInTransaction para geração de títulos por outro módulo"
```

---

## Task 6: Finalizar entrada

**Files:**
- Modify: `backend/app/services/service_entry_service.ts`
- Modify: `backend/app/controllers/service_entries_controller.ts`
- Modify: `backend/start/routes.ts`

**Interfaces:**
- Consumes: `splitInstallments`, `installmentDueDates` (Task 3); `payableService.createFromSource`, `payableSettlementService.settleFullInTransaction` (Task 5); `baseCents` (Task 4).
- Produces: `serviceEntryService.finalize(tenant, id)`; `POST /api/service-entries/:id/finalize` (gate `service_entries.finalize`).

- [ ] **Step 1: Implementar `finalize` no service**

Em `backend/app/services/service_entry_service.ts`, depois de `destroy`. Adicione os imports no topo:

```ts
import PaymentType from '#models/payment_type'
import payableService from '#services/payable_service'
import payableSettlementService from '#services/payable_settlement_service'
import { splitInstallments, installmentDueDates } from '#utils/installments'
```

E o método:

```ts
  /**
   * Turns the entry into money: generates one payable per installment and marks
   * the entry `finalized`.
   *
   * Everything runs in one transaction with the entry locked — there is never a
   * finalized entry without titles, nor titles without a finalized entry.
   */
  async finalize(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const entry = await this.lock(tenant, id, trx)

      if (entry.status !== 'open') {
        throw new BusinessException('Só é possível finalizar uma entrada aberta.')
      }

      const items = await ServiceEntryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
      if (items.length === 0) {
        throw new BusinessException('A entrada precisa ter ao menos um serviço.')
      }

      const base = this.baseCents(entry, items)
      if (base <= 0) {
        throw new BusinessException(
          'O valor a pagar da nota é zero ou negativo. Revise o desconto e os impostos retidos.'
        )
      }
      const count = entry.installmentCount
      if (base < count) {
        throw new BusinessException(
          `O valor da nota não permite dividir em ${count} parcelas.`
        )
      }

      const paymentType = await PaymentType.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('id', entry.paymentTypeId)
        .first()
      if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')

      const amounts = splitInstallments(base, count)
      const dueDates = installmentDueDates(entry.firstDueDate, count)
      // Rastro legível para o usuário; a FK é o rastro que o banco usa.
      const notes = `Título gerado a partir da entrada de serviço: ${entry.id} com o tipo de pagamento: ${paymentType.description}`

      for (let index = 0; index < count; index += 1) {
        const payable = await payableService.createFromSource(
          tenant,
          {
            supplierId: entry.supplierId,
            serviceEntryId: entry.id,
            documentNumber: entry.documentNumber,
            installment: index + 1,
            issueDate: entry.issueDate,
            dueDate: dueDates[index],
            amount: amounts[index] / 100,
            notes,
          },
          trx
        )

        // O tipo de pagamento marcado como "realiza baixa automática" fecha o
        // título já na finalização, na data do vencimento da parcela — uma
        // parcela que vence em novembro não deve aparecer baixada em agosto.
        if (paymentType.autoSettlement) {
          await payableSettlementService.settleFullInTransaction(
            tenant,
            payable,
            entry.paymentTypeId,
            dueDates[index],
            'Baixa automática (tipo de pagamento com baixa automática).',
            trx
          )
        }
      }

      entry.status = 'finalized'
      entry.finalizedAt = DateTime.now()
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }
```

> Confirme o nome da propriedade do flag no model `PaymentType` (`autoSettlement`) e o da descrição (`description`) antes do typecheck.

- [ ] **Step 2: Adicionar a action ao controller**

```ts
  async finalize({ tenant, params }: HttpContext) {
    return serviceEntryService.finalize(tenant, Number(params.id))
  }
```

- [ ] **Step 3: Registrar a rota**

Em `backend/start/routes.ts`, no bloco de entrada de serviço:

```ts
    router
      .post('/service-entries/:id/finalize', [ServiceEntriesController, 'finalize'])
      .use(middleware.permission('service_entries.finalize'))
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Verificar a finalização**

```bash
cat > /tmp/claude-1000/mpmweb-verify/finalize.mjs <<'EOF'
import { login, api, check } from './api.mjs'
const h = await login()

const documentTypeId = (await api(h, 'GET', '/document-types?perPage=1')).body.data[0].id
const supplierId = (await api(h, 'GET', '/suppliers?perPage=1')).body.data[0].id
const serviceId = (await api(h, 'GET', '/services?perPage=1')).body.data[0].id
const types = (await api(h, 'GET', '/payment-types?perPage=200')).body.data
const manual = types.find((t) => !t.autoSettlement)
const auto = types.find((t) => t.autoSettlement)
console.log(`tipo manual: ${manual?.description} | tipo auto: ${auto?.description ?? '(nenhum — crie um com baixa automática)'}`)

async function makeEntry(over = {}) {
  const r = await api(h, 'POST', '/service-entries', {
    documentTypeId, supplierId, paymentTypeId: manual.id,
    documentNumber: 'FIN-' + Math.floor(Math.random() * 1e6),
    issueDate: '2026-08-16', firstDueDate: '2026-09-05',
    discount: 0, taxWithholding: 'recipient',
    iss: 5, pis: 5, cofins: 5, inss: 5, irrf: 5, csll: 5,
    installmentCount: 4,
    items: [{ serviceId, quantity: 1, unitPrice: 9000, discount: 0 }],
    ...over,
  })
  if (r.status !== 201) throw new Error('create falhou: ' + JSON.stringify(r.body))
  return r.body
}

// --- destinatário: impostos abatem -------------------------------------
const e1 = await makeEntry()
const f1 = await api(h, 'POST', `/service-entries/${e1.id}/finalize`)
check('finalize → 200', f1.status === 200, f1.body)
check('vira finalizada', f1.body?.status === 'finalized', f1.body?.status)
check('finalizedAt preenchido', Boolean(f1.body?.finalizedAt), f1.body?.finalizedAt)

const t1 = (await api(h, 'GET', `/payables?documentNumber=${e1.documentNumber}&perPage=50`)).body.data
check('gerou 4 títulos', t1.length === 4, t1.length)
const soma = t1.reduce((s, t) => s + t.amount, 0)
check('soma = 8970 (9000 − 30 de impostos)', Math.round(soma * 100) === 897000, soma)
check('parcelas de 2242,50', t1.every((t) => t.amount === 2242.5), t1.map((t) => t.amount))
check('ordinais 1..4', t1.map((t) => t.installment).sort().join() === '1,2,3,4', t1.map((t) => t.installment))
const vencs = t1.map((t) => t.dueDate).sort()
check('vencimentos mensais', vencs.join() === '2026-09-05,2026-10-05,2026-11-05,2026-12-05', vencs)
check('FK de origem preenchida', t1.every((t) => t.serviceEntryId === e1.id), t1.map((t) => t.serviceEntryId))
check('notes com o rastro', t1[0].notes?.includes(`entrada de serviço: ${e1.id}`), t1[0].notes)
check('nascem abertos (tipo sem baixa automática)', t1.every((t) => t.status === 'open'), t1.map((t) => t.status))

// --- emissor: nada abate -----------------------------------------------
const e2 = await makeEntry({ taxWithholding: 'issuer' })
await api(h, 'POST', `/service-entries/${e2.id}/finalize`)
const t2 = (await api(h, 'GET', `/payables?documentNumber=${e2.documentNumber}&perPage=50`)).body.data
check('emissor: soma = 9000', Math.round(t2.reduce((s, t) => s + t.amount, 0) * 100) === 900000, t2.map((t) => t.amount))

// --- resíduo na última parcela -----------------------------------------
const e3 = await makeEntry({ taxWithholding: 'issuer', installmentCount: 3, items: [{ serviceId, quantity: 1, unitPrice: 1000, discount: 0 }] })
await api(h, 'POST', `/service-entries/${e3.id}/finalize`)
const t3 = (await api(h, 'GET', `/payables?documentNumber=${e3.documentNumber}&perPage=50`)).body.data
  .sort((a, b) => a.installment - b.installment)
check('resíduo na última: 333,33 / 333,33 / 333,34', t3.map((t) => t.amount).join() === '333.33,333.33,333.34', t3.map((t) => t.amount))

// --- baixa automática ---------------------------------------------------
if (auto) {
  const e4 = await makeEntry({ paymentTypeId: auto.id, taxWithholding: 'issuer', installmentCount: 2 })
  await api(h, 'POST', `/service-entries/${e4.id}/finalize`)
  const t4 = (await api(h, 'GET', `/payables?documentNumber=${e4.documentNumber}&perPage=50`)).body.data
  check('auto_settlement: títulos nascem Pagos', t4.every((t) => t.status === 'paid'), t4.map((t) => t.status))
  check('auto_settlement: saldo zero', t4.every((t) => t.balance === 0), t4.map((t) => t.balance))
  const s = (await api(h, 'GET', `/payables/${t4[0].id}/settlements`)).body
  const baixas = Array.isArray(s) ? s : s?.data
  check('baixa na data do vencimento', baixas?.[0]?.settlementDate === t4[0].dueDate, { baixa: baixas?.[0]?.settlementDate, venc: t4[0].dueDate })
} else {
  console.log('  SKIP baixa automática — nenhum tipo de pagamento com auto_settlement=true. Crie um e rode de novo.')
}

// --- rejeições ----------------------------------------------------------
check('re-finalizar → 422', (await api(h, 'POST', `/service-entries/${e1.id}/finalize`)).status === 422)
check('editar finalizada → 422', (await api(h, 'PUT', `/service-entries/${e1.id}`, { ...e1, items: [{ serviceId, quantity: 1, unitPrice: 1, discount: 0 }] })).status === 422)
check('excluir finalizada → 422', (await api(h, 'DELETE', `/service-entries/${e1.id}`)).status === 422)

// base <= 0: impostos maiores que a nota.
const e5 = await makeEntry({ items: [{ serviceId, quantity: 1, unitPrice: 10, discount: 0 }], iss: 100, pis: 0, cofins: 0, inss: 0, irrf: 0, csll: 0 })
const f5 = await api(h, 'POST', `/service-entries/${e5.id}/finalize`)
check('base <= 0 → 422', f5.status === 422, f5.body)
const t5 = (await api(h, 'GET', `/payables?documentNumber=${e5.documentNumber}&perPage=50`)).body.data
check('rollback: nenhum título criado', t5.length === 0, t5.length)
check('rollback: entrada continua aberta', (await api(h, 'GET', `/service-entries/${e5.id}`)).body?.status === 'open')
EOF
node /tmp/claude-1000/mpmweb-verify/finalize.mjs
```

Expected: todas as linhas `ok`. Se não houver nenhum tipo de pagamento com `auto_settlement = true`, crie um pela tela de Tipos de pagamento e rode de novo — **essa asserção não pode ficar sem rodar**, é a primeira vez que o flag é acionado no sistema.

Se o `GET /payables` não aceitar `documentNumber` como filtro exato, ajuste para buscar na listagem completa e filtrar em JS.

- [ ] **Step 6: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/services/service_entry_service.ts backend/app/controllers/service_entries_controller.ts backend/start/routes.ts
git commit -m "feat(servicos): finalizar entrada gera os títulos a pagar parcelados (e baixa automática)"
```

---

## Task 7: Cancelar entrada

**Files:**
- Modify: `backend/app/services/service_entry_service.ts`
- Modify: `backend/app/controllers/service_entries_controller.ts`
- Modify: `backend/start/routes.ts`

**Interfaces:**
- Produces: `serviceEntryService.cancel(tenant, id)`; `POST /api/service-entries/:id/cancel` (gate `service_entries.cancel`).

- [ ] **Step 1: Implementar `cancel` no service**

Adicione os imports:

```ts
import Payable from '#models/payable'
import PayableSettlement from '#models/payable_settlement'
```

E o método, depois de `finalize`:

```ts
  /**
   * Cancels the entry **and every title it generated**, deleting their
   * settlements. There is no reopen: this is how a finalized entry is undone
   * without erasing the document itself.
   *
   * `cancelled` is terminal for both the entry and the titles.
   */
  async cancel(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const entry = await this.lock(tenant, id, trx)

      if (entry.status === 'cancelled') {
        throw new BusinessException('Esta entrada já está cancelada.')
      }

      const payables = await Payable.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
        .whereNot('status', 'cancelled')
        .forUpdate()

      for (const payable of payables) {
        // Mesma mecânica do cancelamento de título: as baixas somem, o pago
        // zera e o status vira terminal (não é recalculado a partir do pago).
        await PayableSettlement.query({ client: trx })
          .where('company_id', tenant.company.id)
          .where('payable_id', payable.id)
          .delete()

        payable.paidAmount = 0
        payable.status = 'cancelled'
        payable.useTransaction(trx)
        await payable.save()
      }

      entry.status = 'cancelled'
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }
```

Títulos **já cancelados** ficam de fora do `where` — cancelar de novo não é erro, é no-op.

- [ ] **Step 2: Adicionar a action ao controller**

```ts
  async cancel({ tenant, params }: HttpContext) {
    return serviceEntryService.cancel(tenant, Number(params.id))
  }
```

- [ ] **Step 3: Registrar a rota**

```ts
    router
      .post('/service-entries/:id/cancel', [ServiceEntriesController, 'cancel'])
      .use(middleware.permission('service_entries.cancel'))
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Verificar o cancelamento**

```bash
cat > /tmp/claude-1000/mpmweb-verify/cancel.mjs <<'EOF'
import { login, api, check } from './api.mjs'
const h = await login()

const documentTypeId = (await api(h, 'GET', '/document-types?perPage=1')).body.data[0].id
const supplierId = (await api(h, 'GET', '/suppliers?perPage=1')).body.data[0].id
const serviceId = (await api(h, 'GET', '/services?perPage=1')).body.data[0].id
const types = (await api(h, 'GET', '/payment-types?perPage=200')).body.data
const manual = types.find((t) => !t.autoSettlement)

const e = (await api(h, 'POST', '/service-entries', {
  documentTypeId, supplierId, paymentTypeId: manual.id,
  documentNumber: 'CANC-' + Math.floor(Math.random() * 1e6),
  issueDate: '2026-08-16', firstDueDate: '2026-09-05',
  taxWithholding: 'issuer', installmentCount: 2,
  items: [{ serviceId, quantity: 1, unitPrice: 1000, discount: 0 }],
})).body

await api(h, 'POST', `/service-entries/${e.id}/finalize`)
let titulos = (await api(h, 'GET', `/payables?documentNumber=${e.documentNumber}&perPage=50`)).body.data
check('2 títulos gerados', titulos.length === 2, titulos.length)

// Baixa parcial em um deles, para provar que o cancelamento apaga a baixa.
const baixa = await api(h, 'POST', `/payables/${titulos[0].id}/settlements`, {
  settlementDate: '2026-09-05', paymentTypeId: manual.id, amount: 100,
})
check('baixa parcial → 201', baixa.status === 201, baixa.body)

const c = await api(h, 'POST', `/service-entries/${e.id}/cancel`)
check('cancel → 200', c.status === 200, c.body)
check('entrada cancelada', c.body?.status === 'cancelled', c.body?.status)

titulos = (await api(h, 'GET', `/payables?documentNumber=${e.documentNumber}&perPage=50`)).body.data
check('todos os títulos cancelados', titulos.every((t) => t.status === 'cancelled'), titulos.map((t) => t.status))
check('paidAmount zerado', titulos.every((t) => Number(t.paidAmount) === 0), titulos.map((t) => t.paidAmount))
const s = (await api(h, 'GET', `/payables/${titulos[0].id}/settlements`)).body
const baixas = Array.isArray(s) ? s : s?.data
check('baixas excluídas', (baixas?.length ?? 0) === 0, baixas)

// Terminal.
check('re-cancelar → 422', (await api(h, 'POST', `/service-entries/${e.id}/cancel`)).status === 422)
check('finalizar cancelada → 422', (await api(h, 'POST', `/service-entries/${e.id}/finalize`)).status === 422)
check('editar cancelada → 422', (await api(h, 'PUT', `/service-entries/${e.id}`, { ...e, items: [{ serviceId, quantity: 1, unitPrice: 1, discount: 0 }] })).status === 422)
check('excluir cancelada → 422', (await api(h, 'DELETE', `/service-entries/${e.id}`)).status === 422)
EOF
node /tmp/claude-1000/mpmweb-verify/cancel.mjs
```

Expected: todas `ok`.

- [ ] **Step 6: Verificar o 409 dos cadastros em uso**

A entrada criada no script anterior ainda existe (cancelar não apaga), então suas FKs continuam presas. A spec exige que excluir um cadastro em uso responda **409 em português** — o `RESTRICT` levanta `23503` e cada service traduz. Confirme que a tradução existe também para este caso novo:

```bash
cat > /tmp/claude-1000/mpmweb-verify/fk-409.mjs <<'EOF'
import { login, api, check } from './api.mjs'
const h = await login()

// Pega os cadastros usados pela última entrada criada.
const entries = (await api(h, 'GET', '/service-entries?perPage=1&status=cancelled')).body.data
if (!entries?.length) throw new Error('rode cancel.mjs antes — precisa de uma entrada existente')
const e = (await api(h, 'GET', `/service-entries/${entries[0].id}`)).body

for (const [label, path, id] of [
  ['serviço', '/services', e.items[0].serviceId],
  ['fornecedor', '/suppliers', e.supplierId],
  ['tipo de documento', '/document-types', e.documentTypeId],
  ['tipo de pagamento', '/payment-types', e.paymentTypeId],
]) {
  const r = await api(h, 'DELETE', `${path}/${id}`)
  check(`excluir ${label} em uso → 409`, r.status === 409, { status: r.status, body: r.body })
  const msg = r.body?.message ?? ''
  check(`  mensagem em português`, /não|possível|uso|vinculad/i.test(msg), msg)
}
EOF
node /tmp/claude-1000/mpmweb-verify/fk-409.mjs
```

Expected: os 4 pares `ok`. Se algum devolver **500** em vez de 409, o service daquele cadastro não traduz o `23503` — adicione o `catch` de FK como os outros módulos fazem, com mensagem em português, e commite junto.

- [ ] **Step 7: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add backend/app/services/service_entry_service.ts backend/app/controllers/service_entries_controller.ts backend/start/routes.ts
git commit -m "feat(servicos): cancelar entrada cancela os títulos gerados e exclui suas baixas"
```

---

## Task 8: Base do frontend — helpers de centavos, RadioGroup, tipos e API client

**Files:**
- Modify: `frontend/src/lib/masks.ts`
- Modify: `frontend/src/modules/payables/payable-form-dialog.tsx`
- Modify: `frontend/src/modules/payables/payable-settlements-dialog.tsx`
- Modify: `frontend/src/modules/receivables/receivable-form-dialog.tsx`
- Modify: `frontend/src/modules/receivables/receivable-settlements-dialog.tsx`
- Modify: `frontend/src/modules/services/service-form-dialog.tsx`
- Modify: `frontend/src/modules/products/product-form-dialog.tsx`
- Create: `frontend/src/components/ui/radio-group.tsx`
- Modify: `frontend/src/types/api.ts`
- Create: `frontend/src/services/service-entries-api.ts`

**Interfaces:**
- Produces:
  - `reaisToCents(value: number | null | undefined): string` e `centsToReais(cents: string): number` exportados de `lib/masks.ts`
  - `RadioGroup`, `RadioGroupItem` de `components/ui/radio-group`
  - tipos `ServiceEntry`, `ServiceEntryItem`, `ServiceEntryStatus`, `TaxWithholding`, `ServiceEntryPayload`
  - `serviceEntriesApi.{list,get,create,update,remove,finalize,cancel}`

- [ ] **Step 1: Promover os dois helpers para `lib/masks.ts`**

No fim de `frontend/src/lib/masks.ts`:

```ts
/**
 * Centavos ("12345") → reais (123.45). Vazio → 0.
 *
 * Vive aqui, e não em cada formulário, porque a conversão de centavos é
 * justamente onde uma cópia divergente causaria estrago silencioso.
 */
export function centsToReais(cents: string): number {
  if (!cents) return 0
  return Number(cents) / 100
}

/** Reais (123.45) → centavos ("12345"), para o form. */
export function reaisToCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(Math.round(value * 100))
}
```

- [ ] **Step 2: Apontar os 6 módulos para o helper compartilhado**

Em **cada** um dos arquivos listados em *Files*, remova a definição local de `centsToReais` e/ou `reaisToCents` e importe de `@/lib/masks` (siga o alias que o arquivo já usa para `maskMoney`). Exemplo, em `payable-form-dialog.tsx`: apague o bloco

```ts
/** Centavos ("12345") → reais (123.45). Vazio → 0. */
function centsToReais(cents: string): number { … }

/** Reais (123.45) → centavos ("12345"), para o form. */
function reaisToCents(value: number | null | undefined): string { … }
```

e acrescente os dois nomes ao import existente de `masks`.

**Nenhuma mudança de comportamento** — as implementações são idênticas. Se alguma cópia divergir da que foi promovida, **pare e reporte**: significa que já havia duas verdades, e qual é a correta é decisão do usuário.

- [ ] **Step 3: Adicionar o primitivo RadioGroup**

```bash
cd frontend && npx shadcn@latest add radio-group
```

Se a CLI não estiver configurada, instale a dep e crie o arquivo à mão:

```bash
cd frontend && npm i @radix-ui/react-radio-group
```

`frontend/src/components/ui/radio-group.tsx`:

```tsx
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
```

Cores só por token (`border-input`, `text-primary`, `fill-primary`, `ring-ring`) — é o que faz o dark mode funcionar.

- [ ] **Step 4: Adicionar os tipos**

Em `frontend/src/types/api.ts`, seguindo o estilo dos tipos de `Payable`:

```ts
export type ServiceEntryStatus = 'open' | 'finalized' | 'cancelled'
export type TaxWithholding = 'issuer' | 'recipient'

export interface ServiceEntryItem {
  id: number
  serviceId: number
  serviceDescription: string | null
  quantity: number
  unitPrice: number
  discount: number
  /** Derivado: quantity × unitPrice − discount. */
  lineTotal: number
}

export interface ServiceEntry {
  id: number
  documentTypeId: number
  documentTypeName: string | null
  supplierId: number
  supplierName: string | null
  paymentTypeId: number
  paymentTypeName: string | null
  documentNumber: string
  series: string | null
  subSeries: string | null
  issueDate: string
  operationDate: string
  discount: number
  taxWithholding: TaxWithholding
  iss: number
  pis: number
  cofins: number
  inss: number
  irrf: number
  csll: number
  installmentCount: number
  firstDueDate: string
  status: ServiceEntryStatus
  finalizedAt: string | null
  /** Σ dos itens (bruto) — o valor da nota. */
  itemsTotal: number
  /** Σ dos 6 impostos, ou 0 quando a retenção é do emissor. */
  withheldTaxes: number
  /** itemsTotal − discount − withheldTaxes: o que vira contas a pagar. */
  netAmount: number
  /** Presente só no `get` (detalhe), ausente na listagem. */
  items?: ServiceEntryItem[]
  createdAt: string | null
}

export interface ServiceEntryItemPayload {
  serviceId: number
  quantity: number
  unitPrice: number
  discount: number
}

export interface ServiceEntryPayload {
  documentTypeId: number
  documentNumber: string
  series?: string
  subSeries?: string
  issueDate: string
  supplierId: number
  discount: number
  taxWithholding: TaxWithholding
  iss: number
  pis: number
  cofins: number
  inss: number
  irrf: number
  csll: number
  paymentTypeId: number
  installmentCount: number
  firstDueDate: string
  items: ServiceEntryItemPayload[]
}

export interface ServiceEntryListParams {
  documentNumber?: string
  supplierId?: number
  operationFrom?: string
  operationTo?: string
  issueFrom?: string
  issueTo?: string
  status?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}
```

- [ ] **Step 5: Criar o API client**

`frontend/src/services/service-entries-api.ts` — espelhe `payables-api.ts` (mesmo import do `apiClient` e mesmo tipo de retorno paginado que os outros módulos usam):

```ts
import { apiClient } from './api-client'
import type {
  ServiceEntry,
  ServiceEntryListParams,
  ServiceEntryPayload,
} from '@/types/api'

export const serviceEntriesApi = {
  async list(params: ServiceEntryListParams) {
    const { data } = await apiClient.get('/service-entries', { params })
    return data as { data: ServiceEntry[]; meta: { total: number; page: number; perPage: number; lastPage: number } }
  },

  async get(id: number) {
    const { data } = await apiClient.get(`/service-entries/${id}`)
    return data as ServiceEntry
  },

  async create(payload: ServiceEntryPayload) {
    const { data } = await apiClient.post('/service-entries', payload)
    return data as ServiceEntry
  },

  async update(id: number, payload: ServiceEntryPayload) {
    const { data } = await apiClient.put(`/service-entries/${id}`, payload)
    return data as ServiceEntry
  },

  async remove(id: number) {
    await apiClient.delete(`/service-entries/${id}`)
  },

  async finalize(id: number) {
    const { data } = await apiClient.post(`/service-entries/${id}/finalize`)
    return data as ServiceEntry
  },

  async cancel(id: number) {
    const { data } = await apiClient.post(`/service-entries/${id}/cancel`)
    return data as ServiceEntry
  },
}
```

> Confira em `payables-api.ts` como o cliente é importado (`apiClient` nomeado vs default) e o formato do tipo paginado — reuse o que já existe em vez de inventar um novo.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros. Se algum dos 6 módulos ficou com import não usado depois de remover a cópia local, o typecheck ou o lint acusa — limpe.

- [ ] **Step 7: Verificar que nada quebrou nas telas existentes**

```bash
cd frontend && npm run build
```

Expected: build limpo. Depois, com `npm run dev`, abra **Contas a pagar** e **Produtos**, edite um registro e confirme que os campos de moeda continuam mascarando e salvando o mesmo valor (é a única mudança de comportamento possível da promoção dos helpers).

- [ ] **Step 8: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add frontend/src/lib/masks.ts frontend/src/components/ui/radio-group.tsx frontend/src/types/api.ts frontend/src/services/service-entries-api.ts frontend/src/modules/payables frontend/src/modules/receivables frontend/src/modules/services frontend/src/modules/products frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): helpers de centavos em lib/masks, primitivo RadioGroup e contrato da entrada de serviço"
```

---

## Task 9: Menu, rotas e listagem

**Files:**
- Modify: `frontend/src/permissions/menu.ts`
- Modify: `frontend/src/routes/router.tsx`
- Create: `frontend/src/modules/service-entries/service-entry-status-badge.tsx`
- Create: `frontend/src/modules/service-entries/service-entries-page.tsx`

**Interfaces:**
- Consumes: `serviceEntriesApi` e os tipos (Task 8); os slugs de permissão (Task 2).
- Produces: `ServiceEntryStatusBadge`; a página `/service-entries`.

- [ ] **Step 1: Adicionar o grupo Serviços ao menu**

Em `frontend/src/permissions/menu.ts`, adicione os ícones ao import de `lucide-react` (`Briefcase`, `FileInput`) e insira o grupo **entre** Financeiro e Configurações:

```ts
  {
    label: 'Serviços',
    icon: Briefcase,
    children: [
      { label: 'Entrada de serviço', to: '/service-entries', icon: FileInput, permission: 'service_entries.view' },
    ],
  },
```

`Briefcase` e não `Wrench` porque `Wrench` já é o ícone de *Grupos de serviço* dentro de Cadastros — reusar confundiria dois níveis diferentes do menu.

- [ ] **Step 2: Registrar as 4 rotas**

Em `frontend/src/routes/router.tsx`, seguindo exatamente o padrão que as rotas de `/payables` e `/companies/new` usam (`PermissionRoute` com o slug):

- `/service-entries` → `ServiceEntriesPage`, permissão `service_entries.view`
- `/service-entries/new` → `ServiceEntryFormPage` (Task 10), permissão `service_entries.create`
- `/service-entries/:id/edit` → `ServiceEntryFormPage`, permissão `service_entries.edit`
- `/service-entries/:id` → `ServiceEntryFormPage` em modo `readOnly`, permissão `service_entries.view`

Registre `/service-entries/new` **antes** de `/service-entries/:id`, senão o router casaria `new` como um id.

Como a Task 10 ainda não criou o form, nesta tarefa registre **só** `/service-entries` e deixe as outras três para a Task 10 — assim esta tarefa compila e é verificável sozinha.

- [ ] **Step 3: Criar o badge de status**

`frontend/src/modules/service-entries/service-entry-status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { ServiceEntryStatus } from '@/types/api'

const LABELS: Record<ServiceEntryStatus, { label: string; variant: 'secondary' | 'success' | 'destructive' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  finalized: { label: 'Finalizada', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

export function ServiceEntryStatusBadge({ status }: { status: ServiceEntryStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
```

Feminino em todos os rótulos — a palavra é "entrada".

- [ ] **Step 4: Criar a listagem**

`frontend/src/modules/service-entries/service-entries-page.tsx`. **Espelhe `frontend/src/modules/payables/payables-page.tsx`** — ele já tem tudo que esta tela precisa: filtro sob demanda com botão Pesquisar, intervalo de datas com checkbox, filtro de status múltiplo, paginação, colunas ordenáveis e menu de Ações. Leia esse arquivo inteiro antes de escrever.

Deltas em relação a ele:

| Aspecto | Nesta tela |
| --- | --- |
| `PageHeader` | `title="Entrada de Serviço"`, `icon={FileInput}` (o mesmo ícone do menu). |
| QueryKey | `['service-entries', tenant.companyId, params]`. |
| Colunas | Código (`id`, ordenável), Nº documento (ordenável), Fornecedor, Tipo de documento, Emissão (ordenável), Data operação (ordenável), Valor da entrada (`formatCurrency(itemsTotal)`, **não ordenável**), Status (`ServiceEntryStatusBadge`), Ações. |
| Datas | `formatIsoDate` — nunca `formatDate`. |
| Ordenação inicial | `sort` vazio → o backend ordena por `operation_date desc, id desc`. |
| Filtro de data 1 | **Data da operação**, checkbox **marcado** por default, do 1º ao último dia do mês corrente (reuse o helper que `payables-page` já usa para montar esse intervalo). |
| Filtro de data 2 | **Data de emissão**, checkbox **desmarcado**. |
| Filtro de status | Aberta / Finalizada / Cancelada (sem "Vencido" — não existe aqui). |
| "Limpar filtros" | Volta ao **default** (operação no mês corrente), não ao vazio. |
| Botão do header | "Nova entrada" gated por `service_entries.create`, navega para `/service-entries/new`. |

Menu **Ações** (`DropdownMenu`), com os itens condicionados **ao status** — itens indisponíveis **não aparecem**, não ficam desabilitados:

| Item | `Can` | Aparece quando |
| --- | --- | --- |
| Visualizar | `service_entries.view` | sempre → `navigate(/service-entries/${id})` |
| Editar | `service_entries.edit` | `status === 'open'` → `navigate(/service-entries/${id}/edit)` |
| Finalizar entrada | `service_entries.finalize` | `status === 'open'` → abre o diálogo da Task 11 |
| Cancelar entrada | `service_entries.cancel` | `status !== 'cancelled'` → `ConfirmDialog` da Task 11 |
| Excluir | `service_entries.delete` | `status === 'open'` → `ConfirmDialog` |

Nesta tarefa, implemente **Visualizar/Editar/Excluir** (Editar e Visualizar só navegam; as rotas chegam na Task 10) e deixe Finalizar/Cancelar como itens que ainda não abrem nada — a Task 11 os liga.

- [ ] **Step 5: Typecheck e build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Verificar na tela**

Com `npm run dev` e o backend rodando, logado como ROOT:

1. O menu tem o grupo **Serviços** **depois** de Financeiro, com "Entrada de serviço".
2. `/service-entries` abre na listagem, com o cabeçalho e o ícone `FileInput`.
3. O filtro de **data da operação** já vem marcado no mês corrente.
4. Se as entradas de verificação das Tasks 4/6/7 ainda existirem, elas aparecem com os status certos (Aberta / Finalizada / Cancelada) e o valor bruto na coluna Valor.
5. Pesquisar por número de documento filtra; "Limpar filtros" devolve ao mês corrente (não ao vazio).
6. Excluir uma entrada **Aberta** funciona; o item Excluir **não aparece** numa Finalizada.

- [ ] **Step 7: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add frontend/src/permissions/menu.ts frontend/src/routes/router.tsx frontend/src/modules/service-entries
git commit -m "feat(servicos): menu Serviços e listagem de entradas de serviço"
```

---

## Task 10: Formulário em rota dedicada

**Files:**
- Create: `frontend/src/modules/service-entries/service-entry-items-section.tsx`
- Create: `frontend/src/modules/service-entries/service-entry-form-page.tsx`
- Modify: `frontend/src/routes/router.tsx`

**Interfaces:**
- Consumes: `serviceEntriesApi`, `RadioGroup`/`RadioGroupItem`, `reaisToCents`/`centsToReais`/`maskMoney` (Task 8); `EntityPicker` com `source="supplier"`.
- Produces: `ServiceEntryFormPage` (props: `mode: 'create' | 'edit' | 'view'`); `ServiceEntryItemsSection`.

- [ ] **Step 1: Criar a seção de itens**

`service-entry-items-section.tsx` — um sub-form controlado por `useFieldArray` do RHF.

Contrato:

```tsx
interface ServiceEntryItemsSectionProps {
  /** Campos do array `items` do formulário pai (RHF `useFieldArray`). */
  name: 'items'
  readOnly?: boolean
}
```

Comportamento:

- Linha de entrada acima da tabela: `Select` de **Serviço** (só ativos, via `servicesApi.list` com `perPage` alto — catálogo pequeno, não usa EntityPicker), `Input` de **Qtd.** (inteiro, ≥ 1, default 1), `MaskedInput` de **Valor** (`maskMoney`, guarda centavos como string) e `MaskedInput` de **Desconto**; um botão **+** (`Plus`) que adiciona à tabela e limpa a linha, e um **×** (`X`, `variant="destructive"`) que remove a linha selecionada da tabela.
- Ao escolher o serviço, **preencher o Valor com o `suggestedValue`** do serviço quando houver (editável). É conveniência; o usuário pode sobrescrever.
- O **+** valida antes de adicionar: serviço obrigatório, `quantity >= 1`, `unitPrice > 0`, `discount <= quantity × unitPrice`. Erro → `toast` em português, sem adicionar.
- Tabela: Cód. serviço, Descrição do serviço, Qtd. lançada, Preço, Desconto, Valor total (`formatCurrency` de `quantity × unitPrice − discount`), e uma coluna de remover por linha.
- Rodapé: `Quantidade de serviços: N` à esquerda e o **total dos serviços** à direita (`formatCurrency` da Σ das linhas).
- Com `readOnly`, some a linha de entrada e a coluna de remover; a tabela fica só de leitura.
- Estado vazio: `EmptyState` com "Nenhum serviço adicionado."

Todos os cálculos em **centavos** (`Math.round(valor * 100)`), nunca somando reais em ponto flutuante.

- [ ] **Step 2: Criar a página do formulário**

`service-entry-form-page.tsx`. **Espelhe `frontend/src/modules/companies/`** para a estrutura de página-formulário em rota dedicada (seções em `Card`, cabeçalho com voltar, rodapé com Salvar/Cancelar), e `payable-form-dialog.tsx` para o tratamento de moeda e datas. Leia os dois antes de escrever.

Estrutura:

```tsx
export function ServiceEntryFormPage({ mode }: { mode: 'create' | 'edit' | 'view' }) { … }
```

- `mode === 'view'` → `readOnly`: todos os campos desabilitados (Inputs, Selects, MaskedInputs, EntityPicker, RadioGroup e a seção de itens), rodapé só com **Fechar**, título "Visualizar entrada de serviço".
- Em `edit` e `view`, carrega com `useQuery(['service-entry', tenant.companyId, id], () => serviceEntriesApi.get(id))`.
- Zod + `zodResolver`. Campos monetários guardados como **string de centavos**; converta com `centsToReais` no submit e `reaisToCents` ao popular.

**Seção 1 — Informações do documento** (`Card`): Tipo de documento (`Select`, só ativos), Número do documento, Série, Sub-série, Data de emissão (`<input type="date">`, default hoje), Fornecedor (`EntityPicker source="supplier"`), Valor de desconto da NFe (`MaskedInput` `maskMoney`).

**Seção 2 — Impostos da nota** (`Card`): `RadioGroup` com as duas opções, em português:

- `issuer` → **"Retenção de imposto por parte do emissor"** (default)
- `recipient` → **"Retenção de imposto por parte do destinatário"**

Abaixo, os 6 campos ISS / PIS / COFINS / INSS / IRRF / CSLL, todos `MaskedInput` com `maskMoney`. Quando `issuer`, ficam **`disabled` e zerados** (`setValue(campo, '')` ao trocar para `issuer`). São **valores em reais** destacados na nota, não alíquotas — o rótulo não deve sugerir percentual.

**Seção 3 — Informações de pagamento** (`Card`): Tipo de pagamento (`Select`, só ativos), Qtd. parcelas (`Input type="number"`, min 1, default 1), 1º vencimento (`<input type="date">`, default hoje).

**Seção 4 — Serviços** (`Card`): `<ServiceEntryItemsSection name="items" readOnly={mode === 'view'} />`.

Submit:

- `create` → `serviceEntriesApi.create` → toast → `navigate('/service-entries')`.
- `edit` → `serviceEntriesApi.update` → toast → `navigate('/service-entries')`.
- Invalida `['service-entries', tenant.companyId]`.
- Erros via `getErrorMessage` + `toast`.
- Bloqueio local antes de enviar: **ao menos um item** ("Adicione ao menos um serviço.").

- [ ] **Step 3: Registrar as 3 rotas restantes**

Em `router.tsx`, adicione `/service-entries/new` (**antes** de `/service-entries/:id`), `/service-entries/:id/edit` e `/service-entries/:id`, cada uma em `PermissionRoute` com o slug correspondente e passando o `mode` certo.

- [ ] **Step 4: Typecheck e build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Verificar na tela**

Com backend + `npm run dev`:

1. **Nova entrada** abre `/service-entries/new` com as 4 seções.
2. O radio começa em **emissor** e os 6 campos de imposto estão **desabilitados**.
3. Trocar para **destinatário** habilita os 6; digitar `5,00` em cada e voltar para **emissor** os desabilita **e zera**.
4. Escolher um serviço preenche o Valor com o valor sugerido (se o serviço tiver um).
5. Adicionar 2 serviços; o rodapé mostra "Quantidade de serviços: 2" e o total certo. Remover um atualiza os dois.
6. Tentar salvar **sem serviço** mostra a mensagem em português e não envia.
7. Salvar cria a entrada **Aberta**, volta para a listagem e ela aparece lá.
8. **Editar** essa entrada carrega tudo preenchido (inclusive fornecedor no EntityPicker e os itens); alterar um item e salvar reflete na listagem.
9. **Visualizar** abre tudo desabilitado, sem botão de salvar.
10. Uma entrada **Finalizada** não oferece Editar no menu de Ações.

- [ ] **Step 6: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add frontend/src/modules/service-entries frontend/src/routes/router.tsx
git commit -m "feat(servicos): formulário da entrada de serviço em rota dedicada"
```

---

## Task 11: Finalizar e Cancelar na interface

**Files:**
- Create: `frontend/src/modules/service-entries/finalize-entry-dialog.tsx`
- Modify: `frontend/src/modules/service-entries/service-entries-page.tsx`

**Interfaces:**
- Consumes: `serviceEntriesApi.finalize/cancel` (Task 8); os campos `itemsTotal`, `discount`, `withheldTaxes`, `netAmount`, `installmentCount`, `firstDueDate` do `ServiceEntry`.

- [ ] **Step 1: Criar o diálogo de finalização**

`finalize-entry-dialog.tsx` — um `Dialog` de confirmação que **mostra o que será gerado antes de gerar**:

```tsx
interface FinalizeEntryDialogProps {
  entry: ServiceEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: () => void
}
```

Corpo, com os valores via `formatCurrency`:

```txt
Total dos serviços       R$ 9.000,00
Desconto da NFe        − R$     0,00
Impostos retidos       − R$    30,00
──────────────────────────────────────
Valor a pagar            R$ 8.970,00

4 parcelas de R$ 2.242,50, a partir de 05/09/2026.
```

- A linha "Impostos retidos" só aparece quando `taxWithholding === 'recipient'`; quando é do emissor, mostre em vez dela o texto *"Retenção por parte do emissor — nada é abatido."*
- O valor da parcela exibido é `Math.floor(netAmountEmCentavos / installmentCount) / 100`; quando a divisão não é exata, acrescente *"(a última parcela absorve a diferença)"*. **Não reimplemente o rateio inteiro no cliente** — o backend é a autoridade; isto é só uma prévia.
- Data via `formatIsoDate(entry.firstDueDate)`.
- Botões: **Cancelar** e **Finalizar entrada** (o segundo com `loading` durante a mutation).

Ao confirmar: `serviceEntriesApi.finalize(entry.id)` → toast de sucesso → invalidar **`['service-entries', tenant.companyId]`** **e** **`['payables', tenant.companyId]`** (a tela de contas a pagar por baixo passa a ter títulos novos) → fechar.

- [ ] **Step 2: Ligar Finalizar e Cancelar no menu de Ações**

Em `service-entries-page.tsx`:

- **Finalizar entrada** (gate `service_entries.finalize`, só em `open`) → abre o `FinalizeEntryDialog` com a linha.
- **Cancelar entrada** (gate `service_entries.cancel`, some quando já `cancelled`) → `ConfirmDialog` com o texto:

  > *"Cancelar esta entrada também cancelará todos os títulos a pagar que ela gerou e excluirá as baixas desses títulos. Esta ação não pode ser desfeita."*

  Confirmando: `serviceEntriesApi.cancel(id)` → toast → invalidar `['service-entries', …]` **e** `['payables', …]`.

Erros dos dois via `getErrorMessage` + `toast` (o backend responde 422 em português).

- [ ] **Step 3: Typecheck e build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Roteiro manual completo**

Com backend + `npm run dev`, logado como ROOT. Este é o teste de aceitação da feature inteira:

1. Crie uma entrada: fornecedor qualquer, **retenção pelo destinatário**, R$ 5,00 em cada um dos 6 impostos, **4 parcelas**, 1º vencimento **05/09/2026**, um serviço de **R$ 9.000,00**.
2. Ações → **Finalizar entrada**. O diálogo mostra `9.000,00`, impostos `30,00`, valor a pagar `8.970,00`, "4 parcelas de R$ 2.242,50 a partir de 05/09/2026".
3. Confirme. A entrada vira **Finalizada** e some dela as ações Editar / Finalizar / Excluir.
4. Vá em **Financeiro → Contas a pagar**: 4 títulos novos, de R$ 2.242,50, vencendo em 05/09, 05/10, 05/11 e 05/12, com a observação *"Título gerado a partir da entrada de serviço: N com o tipo de pagamento: …"*.
5. Registre uma **baixa parcial** em um desses títulos.
6. Volte em Entrada de Serviço → Ações → **Cancelar entrada**, confirme.
7. Em Contas a pagar, os 4 títulos estão **Cancelados** e o que tinha baixa está com saldo/pago zerados e **sem baixas**.
8. Repita 1–3 com **retenção pelo emissor**: o valor a pagar deve ser os **R$ 9.000,00** cheios.
9. Repita com um tipo de pagamento marcado como **"realiza baixa automática"**: os títulos gerados nascem **Pagos**, com baixa na data de cada vencimento.
10. Em **Configurações → Perfis**, crie um perfil com `service_entries.view/create/edit/delete` **sem** `finalize` e **sem** `cancel`; entre com um usuário desse perfil e confirme que as duas ações **não aparecem** no menu.

Qualquer passo que falhe é bug — corrija antes de commitar.

- [ ] **Step 5: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add frontend/src/modules/service-entries
git commit -m "feat(servicos): finalizar e cancelar entrada na interface"
```

---

## Task 12: Documentação do estado

**Files:**
- Modify: `state.md`

- [ ] **Step 1: Atualizar o `state.md`**

O arquivo é o snapshot que as próximas sessões leem. Atualize:

1. **Snapshot**: a data de hoje.
2. **Esquema do banco**: o contador de tabelas (+2) e duas linhas novas na tabela:
   - `service_entries` — cabeçalho da nota de serviço; FKs `company_id`, `document_type_id`, `supplier_id`, `payment_type_id` (todas `RESTRICT`); `tax_withholding` (`issuer`/`recipient`); 6 colunas de imposto; `installment_count` + `first_due_date`; `status` (`open`/`finalized`/`cancelled`) e `finalized_at`, **resultados** movidos só por finalizar/cancelar. Hard delete **só quando aberta**.
   - `service_entry_items` — os serviços da nota; `quantity` **inteiro**; `lineTotal` derivado, nunca gravado; substituição **em bloco** no update.
3. Na linha de `payables`, registre a coluna **`service_entry_id`** (nullable, `RESTRICT`) e o que ela significa (origem do título; futura convivência com o lançamento direto financeiro).
4. **Módulos entregues**: um item **Entrada de serviço** descrevendo o fluxo aberta → finalizada → cancelada, a fórmula da base, o rateio (resíduo na última), os vencimentos mensais e o acionamento do `auto_settlement` — que **até aqui nunca tinha sido usado**.
5. **RBAC**: acrescente `service_entries.*` (inclui `finalize` e `cancel`) à lista de slugs.
6. **Rotas**: os 7 endpoints e as 4 rotas do frontend.
7. **Menu lateral**: passa a ter o grupo **Serviços** (hoje o texto cita só Cadastros, Financeiro e Configurações).
8. Em **Onde encontrar mais**, remova o "**Ainda não implementada.**" da linha de `docs/spec/servicos/`.
9. Se a promoção de `reaisToCents`/`centsToReais` merecer registro, acrescente à seção de convenções.

- [ ] **Step 2: Commit**

```bash
cd /home/csantana/projects/cartech/mpmweb
git add state.md
git commit -m "docs(state): atualiza snapshot com o módulo Entrada de Serviço"
```

---

## Cobertura da spec

| Requisito da spec | Task |
| --- | --- |
| Tabelas `service_entries` / `service_entry_items`, coluna em `payables` | 1 |
| 6 permissões + rótulo do módulo | 2 |
| Rateio (resíduo na última) e vencimentos mensais | 3 |
| CRUD, substituição de itens em bloco, validações de consistência | 4 |
| Retenção pelo emissor zera os impostos no backend | 4 |
| `createFromSource` / `settleFullInTransaction` (título com um dono só) | 5 |
| Finalizar: base, parcelas, títulos, `notes` de rastro, transação | 6 |
| `auto_settlement` honrado pela primeira vez | 6 |
| Rejeições da finalização (não aberta, sem itens, base ≤ 0, parcela < 1 centavo) | 6 |
| Cancelar entrada + títulos + baixas; terminal | 7 |
| 409 ao excluir serviço/fornecedor/tipo em uso por uma entrada | 7 |
| `radio-group`; centavos em `lib/masks.ts`; tipos; API client | 8 |
| Menu Serviços depois de Financeiro; listagem, filtros, menu Ações | 9 |
| Formulário em rota dedicada, 4 seções, `readOnly` | 10 |
| Diálogo de finalização com o resumo; invalidação de `['payables']` | 11 |
| `finalize`/`cancel` como poderes independentes de `edit` | 2 (catálogo), 6 e 7 (gate), 11 (verificação manual) |
| `state.md` | 12 |

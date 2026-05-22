---
name: gerar-crud-simples
description: Gera um CRUD novo do padrão "simples" no MPM Web (descrição + status, multitenant, hard delete, modal) seguindo a rule simple-crud-pattern. Use quando o usuário invocar `/gerar-crud-simples` ou pedir explicitamente para gerar/scaffoldar um cadastro desse formato. Pergunta interativamente os parâmetros do domínio (label, tabela, ícone), gera spec + backend + frontend, roda migration/seed/typecheck e para antes do commit.
---

# Gerador de CRUD simples — MPM Web

Você está scaffoldando um cadastro novo seguindo a rule [`simple-crud-pattern`](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md). O caso canônico de referência é o módulo **payment_types** já implementado — sempre que algo nesta skill estiver ambíguo, **olhe o canônico** e replique.

## Pré-condições (faça primeiro)

1. **Working tree limpo.** Rode `git status`. Se houver mudanças não commitadas, pare e peça pro usuário commitar/stash primeiro.
2. **Tem que estar no projeto certo.** Confirme que existe `backend/CLAUDE.md`, `frontend/CLAUDE.md` e o arquivo da rule em `frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md`.
3. **Leia a rule.** Antes de fazer perguntas, leia o conteúdo da rule. Use-a como autoridade — se houver conflito entre esta skill e a rule, a rule vence.

## Fluxo da skill

Use `TodoWrite` para criar uma lista com as etapas abaixo e marque cada uma conforme avança.

### Etapa 1 — Coletar informações (perguntar 1 a 1)

Use `AskUserQuestion` para cada item. **Uma pergunta de cada vez** — não bombardeie o usuário.

**Pergunta 1: Como o cadastro se chama no singular em pt-BR?**
Exemplo: `tipo de documento`, `categoria de produto`, `unidade de medida`. Aceite resposta livre.

**Pergunta 2: E no plural em pt-BR?**
Sugira o plural mais provável (acrescentando "s" ou ajustando) e peça confirmação. Exemplo: singular "tipo de documento" → sugestão "tipos de documento".

**Pergunta 3: O substantivo principal é masculino ou feminino?**
Opções: Masculino (o/este/Ativo) vs Feminino (a/esta/Ativa). Decide os artigos e concordâncias nas mensagens.

**Pergunta 4: Nome da tabela em inglês (snake_case plural)?**
Sugira a partir da resposta da Pergunta 1 (ex.: "tipo de documento" → `document_types`). Peça confirmação ou edição. Validar: só `[a-z_]+`, terminar em "s" ou similar plural.

**Pergunta 5: Ícone do lucide-react?**
Apresente 3 sugestões razoáveis baseadas no domínio (ex.: para "categoria de produto" → `Tags`, `LayoutGrid`, `FolderTree`). Aceite outro nome se o usuário preferir. O nome é PascalCase, sem aspas.

**Pergunta 6: 2 a 4 exemplos típicos do domínio (separados por vírgula).**
Usados na seção "Exemplos" da spec. Ex.: para `document_types` → "NF-e, Recibo, Contrato, RG".

### Etapa 2 — Computar valores derivados e confirmar

A partir das respostas, **derive**:

| Variável | Como derivar | Exemplo (`document_types`) |
| --- | --- | --- |
| `TABLE` | resposta da P4 | `document_types` |
| `MODULE_SLUG` | igual ao `TABLE` | `document_types` |
| `URL` | `TABLE` com `_` → `-` | `document-types` |
| `MODULE_FOLDER` | igual ao `URL` | `document-types` |
| `MODEL_CLASS` | PascalCase singular: split por `_`, capitalize cada, juntar, e singularizar a última palavra (remover `s` final salvo casos como `addresses → address`) | `DocumentType` |
| `MODEL_VAR` | camelCase = `MODEL_CLASS` com primeira letra minúscula | `documentType` |
| `MODEL_VAR_PLURAL` | camelCase plural: `MODEL_VAR` + ajuste plural | `documentTypes` |
| `LABEL_PT` | resposta da P1 (singular) | `tipo de documento` |
| `LABEL_PT_PLURAL` | resposta da P2 | `tipos de documento` |
| `LABEL_PT_PLURAL_CAP` | `LABEL_PT_PLURAL` com primeira letra maiúscula | `Tipos de documento` |
| `ARTICLE_DEF` | "o" se masculino, "a" se feminino | `o` |
| `THIS_PRONOUN` | "este" se masculino, "esta" se feminino | `este` |
| `ACTIVE_ADJ` | "Ativo" se masculino, "Ativa" se feminino | `Ativo` |
| `INACTIVE_ADJ` | "Inativo" se masculino, "Inativa" se feminino | `Inativo` |
| `ICON` | resposta da P5 | `FileText` |
| `EXAMPLES` | resposta da P6 (mantém como veio) | `NF-e, Recibo, Contrato, RG` |
| `SPEC_NUMBER` | próximo número em `docs/spec/cadastros/` (ex.: se existem 001, 002, 003, o próximo é `004`) | `004` |
| `SPEC_SLUG` | kebab-case do `LABEL_PT` (espaços viram `-`, sem "de" se ficar feio) | `tipo-documento` |
| `TIMESTAMP` | execute `date +%s%3N` via Bash para timestamp da migration | `1779417370921` |

**Confirme** todos os valores derivados ao usuário em uma única mensagem antes de gerar arquivos. Se algo soar errado, ajuste e mostre de novo.

### Etapa 3 — Gerar a spec

Crie `docs/spec/cadastros/<SPEC_NUMBER>-criar-tela-<SPEC_SLUG>.md`. Use o template da seção **"Template da spec"** no final desta skill, fazendo as substituições.

### Etapa 4 — Backend

Crie/atualize, **nesta ordem**:

1. `backend/database/migrations/<TIMESTAMP>_create_<TABLE>_table.ts` — ver template **migration**.
2. `backend/app/abilities/catalog.ts` — adicione 4 permissões (`<MODULE_SLUG>.view/create/edit/delete`) **logo após** a última seção de permissões existente. Cada uma com `name`, `module`, `action`, `description` em pt-BR. Ver template **catalog**.
3. `backend/app/models/<MODULE_SLUG_SINGULAR>.ts` — model Lucid. Ver template **model**. (`MODULE_SLUG_SINGULAR` = nome do arquivo = `MODULE_SLUG` no singular, ex.: `document_type`.)
4. `backend/app/repositories/<MODULE_SLUG_SINGULAR>_repository.ts` — ver template **repository**.
5. `backend/app/validators/<MODULE_SLUG_SINGULAR>_validators.ts` — ver template **validator**.
6. `backend/app/services/<MODULE_SLUG_SINGULAR>_service.ts` — ver template **service** (inclui tratamento de FK violation `23503` → `ConflictException`).
7. `backend/app/controllers/<MODULE_SLUG>_controller.ts` — ver template **controller**.
8. `backend/start/routes.ts` — adicione o import do controller e o bloco de 5 rotas (index/store/show/update/destroy) dentro do grupo já existente que tem `middleware.auth() + middleware.tenant()`. Ver template **routes**.

### Etapa 5 — Frontend

1. `frontend/src/types/api.ts` — adicione a interface `<MODEL_CLASS>` no final do arquivo. Ver template **type**.
2. `frontend/src/services/<URL>-api.ts` — ver template **api-client**.
3. `frontend/src/permissions/menu.ts` — adicione import do `<ICON>` (no agrupado lucide-react) e item de menu. Ver template **menu**.
4. `frontend/src/routes/router.tsx` — adicione import lazy + bloco `PermissionRoute` com `path: '<URL>'`. Ver template **router**.
5. `frontend/src/modules/<MODULE_FOLDER>/<MODULE_FOLDER>-page.tsx` — listagem. Ver template **page**.
6. `frontend/src/modules/<MODULE_FOLDER>/<MODEL_VAR_KEBAB>-form-dialog.tsx` — modal. (`MODEL_VAR_KEBAB` = singular do `MODULE_FOLDER`, ex.: `document-type`.) Ver template **dialog**.

### Etapa 6 — Validar e migrar

Execute **em sequência** (se algum falhar, pare e reporte):

```bash
cd backend && npm run typecheck
cd backend && node ace migration:run
cd backend && node ace db:seed
cd frontend && npx tsc --noEmit
```

### Etapa 7 — Atualizar state.md

Em `state.md` (raiz):
- Atualize a contagem de tabelas no header da seção "Esquema do banco" (`8 tabelas` → próximo número).
- Adicione uma linha na tabela: `` | `<TABLE>` | <descrição curta>. Hard delete, multitenant. ``
- Em "Módulos entregues": adicione `- **<LABEL_PT_PLURAL_CAP> (CRUD)** — CRUD simples padrão. Ver rule [simple-crud-pattern].`
- Em "Rotas → Backend": adicione `- ``GET|POST /<URL>``, ``GET|PUT|DELETE /<URL>/:id`` `.
- Em "Rotas → Frontend": acrescente `/<URL>` à lista de rotas protegidas.

Atualize o campo `**Snapshot**:` para a data de hoje (use `date +%Y-%m-%d`).

### Etapa 8 — Reportar (NÃO commitar)

**NÃO faça `git commit`.** Apresente ao usuário:

- ✅ Lista de arquivos criados e editados
- ✅ Resultado de typecheck e migration
- 📋 Como testar manualmente (URL, login, primeiro passo)
- 🚦 Pergunta final: "Quer que eu commite isso ou prefere revisar antes?"

---

## Templates

Use estes blocos como esqueleto. Substitua **todas** as variáveis `{{...}}` antes de escrever o arquivo. Não deixe nenhuma `{{` no resultado.

### Template da spec

````markdown
# Spec: Criar tela de {{LABEL_PT}}

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: {{LABEL_PT}}
- Exemplos: {{EXAMPLES}}
- Justificativa de negócio: <peça ao usuário em 1 frase, ou herde do contexto>

## Específicos do módulo
- Tabela: `{{TABLE}}`
- Slug do módulo: `{{MODULE_SLUG}}`
- Endpoints: `/api/{{URL}}`
- Rota frontend: `/{{URL}}`
- Módulo frontend: `src/modules/{{MODULE_FOLDER}}/`
- Ícone (lucide-react): `{{ICON}}`
- Label do menu: "{{LABEL_PT_PLURAL_CAP}}"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
````

### Template migration

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * {{LABEL_PT_PLURAL_CAP}} per company. Hard delete (no `deleted_at`).
 * Description is not unique — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = '{{TABLE}}'

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

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'description'], '{{TABLE}}_company_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### Template catalog

Adicione **dentro** do array `PERMISSIONS` em `backend/app/abilities/catalog.ts`, após a última seção existente:

```ts
  // {{LABEL_PT_PLURAL_CAP}}
  { slug: '{{MODULE_SLUG}}.view', name: 'Visualizar {{LABEL_PT_PLURAL}}', module: '{{MODULE_SLUG}}', action: 'view', description: 'Listar e consultar {{LABEL_PT_PLURAL}} da empresa.' },
  { slug: '{{MODULE_SLUG}}.create', name: 'Criar {{LABEL_PT_PLURAL}}', module: '{{MODULE_SLUG}}', action: 'create', description: 'Cadastrar {{LABEL_PT_PLURAL}}.' },
  { slug: '{{MODULE_SLUG}}.edit', name: 'Editar {{LABEL_PT_PLURAL}}', module: '{{MODULE_SLUG}}', action: 'edit', description: 'Alterar {{LABEL_PT_PLURAL}} existentes.' },
  { slug: '{{MODULE_SLUG}}.delete', name: 'Excluir {{LABEL_PT_PLURAL}}', module: '{{MODULE_SLUG}}', action: 'delete', description: 'Remover {{LABEL_PT_PLURAL}}.' },
```

### Template model

```ts
import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'

/**
 * {{MODEL_CLASS}} — per-company catalog entry. No soft delete: removal is
 * permanent. FK to companies prevents the underlying company from being
 * deleted while it still has rows here.
 */
export default class {{MODEL_CLASS}} extends BaseModel {
  static table = '{{TABLE}}'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column()
  declare description: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
```

### Template repository

```ts
import {{MODEL_CLASS}} from '#models/{{MODULE_SLUG_SINGULAR}}'

/**
 * Data access for {{LABEL_PT_PLURAL}}. Always scoped by company.
 */
export class {{MODEL_CLASS}}Repository {
  query(companyId: number) {
    return {{MODEL_CLASS}}.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new {{MODEL_CLASS}}Repository()
```

### Template validator

```ts
import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
})

export const create{{MODEL_CLASS}}Validator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    isActive: vine.boolean().optional(),
  })
)
create{{MODEL_CLASS}}Validator.messagesProvider = messages

export const update{{MODEL_CLASS}}Validator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
update{{MODEL_CLASS}}Validator.messagesProvider = messages
```

> Atenção: as duas linhas com `{{ min }}` / `{{ max }}` dentro das strings de mensagem NÃO são variáveis da skill — são placeholders do VineJS e devem ficar literais no arquivo final.

### Template service

```ts
import {{MODEL_CLASS}} from '#models/{{MODULE_SLUG_SINGULAR}}'
import type { TenantContext } from '#services/tenant_context'
import {{MODEL_VAR}}Repository from '#repositories/{{MODULE_SLUG_SINGULAR}}_repository'
import { ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface Create{{MODEL_CLASS}}DTO {
  description: string
  isActive?: boolean
}

export interface Update{{MODEL_CLASS}}DTO {
  description?: string
  isActive?: boolean
}

export class {{MODEL_CLASS}}Service {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = {{MODEL_VAR}}Repository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

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
    const row = await {{MODEL_VAR}}Repository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('{{LABEL_PT_CAP}} não encontrad{{GENDER_SUFFIX}}.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: Create{{MODEL_CLASS}}DTO) {
    const row = await {{MODEL_CLASS}}.create({
      companyId: tenant.company.id,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: Update{{MODEL_CLASS}}DTO) {
    const row = await {{MODEL_VAR}}Repository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('{{LABEL_PT_CAP}} não encontrad{{GENDER_SUFFIX}}.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await {{MODEL_VAR}}Repository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('{{LABEL_PT_CAP}} não encontrad{{GENDER_SUFFIX}}.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir {{THIS_PRONOUN}} {{LABEL_PT}} porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: {{MODEL_CLASS}}) {
    return {
      id: row.id,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new {{MODEL_CLASS}}Service()
```

`LABEL_PT_CAP` = `LABEL_PT` com 1ª letra maiúscula (ex.: "Tipo de documento").
`GENDER_SUFFIX` = `o` se masculino, `a` se feminino — para concordar com "não encontrad__".

### Template controller

```ts
import { HttpContext } from '@adonisjs/core/http'
import {{MODEL_VAR}}Service from '#services/{{MODULE_SLUG_SINGULAR}}_service'
import {
  create{{MODEL_CLASS}}Validator,
  update{{MODEL_CLASS}}Validator,
} from '#validators/{{MODULE_SLUG_SINGULAR}}_validators'

export default class {{MODEL_CLASS_PLURAL}}Controller {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return {{MODEL_VAR}}Service.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return {{MODEL_VAR}}Service.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(create{{MODEL_CLASS}}Validator)
    const row = await {{MODEL_VAR}}Service.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(update{{MODEL_CLASS}}Validator)
    return {{MODEL_VAR}}Service.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await {{MODEL_VAR}}Service.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
```

`MODEL_CLASS_PLURAL` = `MODEL_CLASS` + `s` (ex.: `DocumentTypes`).

### Template routes

Em `backend/start/routes.ts`:

**Acima** dos demais imports de controller, adicione:

```ts
const {{MODEL_CLASS_PLURAL}}Controller = () => import('#controllers/{{MODULE_SLUG}}_controller')
```

Dentro do grupo `.use([middleware.auth(), middleware.tenant()])` (que já existe), depois das rotas existentes mas **antes** do `})` final, adicione:

```ts
    // {{LABEL_PT_PLURAL_CAP}}
    router
      .get('/{{URL}}', [{{MODEL_CLASS_PLURAL}}Controller, 'index'])
      .use(middleware.permission('{{MODULE_SLUG}}.view'))
    router
      .post('/{{URL}}', [{{MODEL_CLASS_PLURAL}}Controller, 'store'])
      .use(middleware.permission('{{MODULE_SLUG}}.create'))
    router
      .get('/{{URL}}/:id', [{{MODEL_CLASS_PLURAL}}Controller, 'show'])
      .use(middleware.permission('{{MODULE_SLUG}}.view'))
    router
      .put('/{{URL}}/:id', [{{MODEL_CLASS_PLURAL}}Controller, 'update'])
      .use(middleware.permission('{{MODULE_SLUG}}.edit'))
    router
      .delete('/{{URL}}/:id', [{{MODEL_CLASS_PLURAL}}Controller, 'destroy'])
      .use(middleware.permission('{{MODULE_SLUG}}.delete'))
```

### Template type

Em `frontend/src/types/api.ts`, no final do arquivo:

```ts
export interface {{MODEL_CLASS}} {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}
```

### Template api-client

```ts
import { api } from '@/services/api-client'
import type { Paginated, {{MODEL_CLASS}} } from '@/types/api'

export interface {{MODEL_CLASS}}ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface Create{{MODEL_CLASS}}Payload {
  description: string
  isActive?: boolean
}

export interface Update{{MODEL_CLASS}}Payload {
  description?: string
  isActive?: boolean
}

export const {{MODEL_VAR_PLURAL}}Api = {
  list: (params: {{MODEL_CLASS}}ListParams) =>
    api.get<Paginated<{{MODEL_CLASS}}>>('/{{URL}}', { params }).then((r) => r.data),

  get: (id: number) => api.get<{{MODEL_CLASS}}>(`/{{URL}}/${id}`).then((r) => r.data),

  create: (payload: Create{{MODEL_CLASS}}Payload) =>
    api.post<{{MODEL_CLASS}}>('/{{URL}}', payload).then((r) => r.data),

  update: (id: number, payload: Update{{MODEL_CLASS}}Payload) =>
    api.put<{{MODEL_CLASS}}>(`/{{URL}}/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/{{URL}}/${id}`).then(() => undefined),
}
```

### Template menu

Em `frontend/src/permissions/menu.ts`:

1. No bloco de import do lucide-react, adicione `{{ICON}}` em ordem alfabética.
2. No array `MENU`, acrescente após o último item:

```ts
  { label: '{{LABEL_PT_PLURAL_CAP}}', to: '/{{URL}}', icon: {{ICON}}, permission: '{{MODULE_SLUG}}.view' },
```

### Template router

Em `frontend/src/routes/router.tsx`:

1. Adicione um novo `lazy()` ao lado dos existentes:

```ts
const {{MODEL_CLASS_PLURAL}}Page = lazy(() =>
  import('@/modules/{{MODULE_FOLDER}}/{{MODULE_FOLDER}}-page').then((m) => ({
    default: m.{{MODEL_CLASS_PLURAL}}Page,
  }))
)
```

2. Dentro do array de children do `AppLayout`, antes de fechar, adicione:

```tsx
          {
            element: <PermissionRoute permission="{{MODULE_SLUG}}.view" />,
            children: [{ path: '{{URL}}', element: <{{MODEL_CLASS_PLURAL}}Page /> }],
          },
```

### Template page

`frontend/src/modules/{{MODULE_FOLDER}}/{{MODULE_FOLDER}}-page.tsx`:

```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, {{ICON}} } from 'lucide-react'
import { toast } from 'sonner'
import { {{MODEL_VAR_PLURAL}}Api } from '@/services/{{URL}}-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { getErrorMessage } from '@/lib/errors'
import type { {{MODEL_CLASS}} } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { {{MODEL_CLASS}}FormDialog } from '@/modules/{{MODULE_FOLDER}}/{{MODEL_VAR_KEBAB}}-form-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PER_PAGE = 20

export function {{MODEL_CLASS_PLURAL}}Page() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{{MODEL_CLASS}} | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['{{URL}}', companyId, page, sort],
    queryFn: () =>
      {{MODEL_VAR_PLURAL}}Api.list({
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {{MODEL_VAR_PLURAL}}Api.remove(id),
    onSuccess: () => {
      toast.success('{{LABEL_PT_CAP}} removid{{GENDER_SUFFIX}}.')
      queryClient.invalidateQueries({ queryKey: ['{{URL}}'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: {{MODEL_CLASS}}) {
    setEditing(row)
    setFormOpen(true)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="{{LABEL_PT_PLURAL_CAP}}"
        description="Cadastre {{ARTICLE_DEF}}s {{LABEL_PT_PLURAL}} aceit{{GENDER_SUFFIX}}s pela empresa ativa."
      >
        <Can permission="{{MODULE_SLUG}}.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nov{{GENDER_SUFFIX}} {{LABEL_PT}}
          </Button>
        </Can>
      </PageHeader>

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ {{ICON}} }
            title="Nenhum{{GENDER_SUFFIX_E}} {{LABEL_PT}} cadastrad{{GENDER_SUFFIX}}"
            description="Cadastre {{ARTICLE_DEF}} primeir{{GENDER_SUFFIX}} {{LABEL_PT}} desta empresa."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="description" sort={sort} onSort={toggleSort}>
                  Descrição
                </SortableHeader>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? '{{ACTIVE_ADJ}}' : '{{INACTIVE_ADJ}}'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="{{MODULE_SLUG}}.edit">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="{{MODULE_SLUG}}.delete">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)} aria-label="Excluir">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <{{MODEL_CLASS}}FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        {{MODEL_VAR}}={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir {{LABEL_PT}}"
        description="Esta ação é permanente. Se {{ARTICLE_DEF}} {{LABEL_PT}} já estiver vinculad{{GENDER_SUFFIX}} a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
```

`GENDER_SUFFIX_E` = `""` se masculino, `"a"` se feminino — para o "Nenhum" / "Nenhuma".
`MODEL_VAR_KEBAB` = singular do `MODULE_FOLDER` (ex.: `document-type`).

### Template dialog

`frontend/src/modules/{{MODULE_FOLDER}}/{{MODEL_VAR_KEBAB}}-form-dialog.tsx`:

```tsx
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  {{MODEL_VAR_PLURAL}}Api,
  type Create{{MODEL_CLASS}}Payload,
  type Update{{MODEL_CLASS}}Payload,
} from '@/services/{{URL}}-api'
import { getErrorMessage } from '@/lib/errors'
import type { {{MODEL_CLASS}} } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface {{MODEL_CLASS}}FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  {{MODEL_VAR}}: {{MODEL_CLASS}} | null
}

export function {{MODEL_CLASS}}FormDialog({
  open,
  onOpenChange,
  {{MODEL_VAR}},
}: {{MODEL_CLASS}}FormDialogProps) {
  const isEdit = Boolean({{MODEL_VAR}})
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', isActive: true },
  })

  useEffect(() => {
    if (!open) return
    reset({
      description: {{MODEL_VAR}}?.description ?? '',
      isActive: {{MODEL_VAR}}?.isActive ?? true,
    })
  }, [open, {{MODEL_VAR}}, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description.trim(),
        isActive: values.isActive,
      }
      if (isEdit && {{MODEL_VAR}}) {
        return {{MODEL_VAR_PLURAL}}Api.update({{MODEL_VAR}}.id, payload satisfies Update{{MODEL_CLASS}}Payload)
      }
      return {{MODEL_VAR_PLURAL}}Api.create(payload satisfies Create{{MODEL_CLASS}}Payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? '{{LABEL_PT_CAP}} atualizad{{GENDER_SUFFIX}}.' : '{{LABEL_PT_CAP}} criad{{GENDER_SUFFIX}}.')
      queryClient.invalidateQueries({ queryKey: ['{{URL}}'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar {{LABEL_PT}}' : 'Nov{{GENDER_SUFFIX}} {{LABEL_PT}}'}</DialogTitle>
        </DialogHeader>

        <form
          id="{{URL}}-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" autoFocus {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">{{ACTIVE_ADJ}}</Label>
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="{{URL}}-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Princípios

- **Espelhe sempre o canônico (`payment_types`).** Se algo soar diferente, é bug — não improvise.
- **Não invente decisões.** A rule [`simple-crud-pattern`](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md) é a autoridade. Se o usuário pedir algo que viola a rule (ex.: "torna unique a descrição"), pare e diga: "Isso foge da rule simple-crud-pattern; recomendo escrever uma spec à parte. Quer continuar fora do padrão ou ajustar?"
- **Nunca commite.** Termine sempre apresentando o que mudou e perguntando se deve commitar.
- **Concordância de gênero.** Português é cruel. Se errar masculino/feminino fica feio na UI. Confira `GENDER_SUFFIX` em todos os lugares que usam.
- **Sem ICON inexistente.** Antes de usar um ícone, garanta que existe no `lucide-react` — em caso de dúvida grep o `node_modules/lucide-react` ou consulte a sugestão razoável (todos os listados na P5 existem).

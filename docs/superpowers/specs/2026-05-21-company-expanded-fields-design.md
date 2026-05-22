# Expansão do cadastro de Empresa — design

**Data**: 2026-05-21
**Status**: Aprovado, pronto para plano de implementação

## Objetivo

Adicionar 11 campos ao cadastro de `Company` (identificação fiscal extra,
endereço, contato e logomarca) preservando os padrões do projeto:
multiempresa, soft delete, idioma código-em-inglês/UI-em-português, e as
regras da skill `mpmweb-ui-patterns`.

Campos novos:
inscrição estadual, inscrição municipal, endereço, número, bairro, cidade,
CEP, UF, fone, email, logomarca (upload de arquivo).

Todos são **opcionais** — a única obrigatoriedade do cadastro continua
sendo a razão social.

A logo é armazenada em disco local no backend em desenvolvimento. Em
produção, basta trocar o disk do Drive para S3/R2 — o código de negócio
não muda.

## Decisões já tomadas (brainstorming)

1. Todos os campos novos são **opcionais**.
2. O formulário deixa de ser modal e passa a ser **rota dedicada** (`/companies/new`, `/companies/:id/edit`), seguindo a regra [crud-form-presentation](../../frontend/.agents/skills/mpmweb-ui-patterns/rules/crud-form-presentation.md) (muitos campos → rota).
3. **Sem integração ViaCEP** — usuário preenche endereço manualmente.
4. Logo aceita **PNG/JPG/JPEG/WEBP/SVG até 2 MB**.
5. Storage via **`@adonisjs/drive` com disk `local`** apontando para `storage/uploads/logos/`.
6. Upload em **multipart único** (não há endpoint separado): o form envia campos + arquivo numa só requisição.
7. Fone com **máscara Brasil 10/11 dígitos**, detectada automaticamente (fixo vs celular).
8. URL da logo guardada no banco como **caminho relativo** (`/uploads/logos/{slug}-{timestamp}.{ext}`); o backend monta a URL absoluta no `serialize()` usando `env.APP_URL`.

## 1. Schema do banco

Migration nova `add_address_contact_logo_to_companies` (alter, não recria).

| Coluna | Tipo | Null | Observação |
|---|---|---|---|
| `state_registration` | `varchar(30)` | sim | inscrição estadual (dígitos ou "ISENTO") |
| `municipal_registration` | `varchar(30)` | sim | inscrição municipal |
| `address` | `varchar(180)` | sim | logradouro |
| `address_number` | `varchar(20)` | sim | número (`s/n` é válido) |
| `neighborhood` | `varchar(120)` | sim | bairro |
| `city` | `varchar(120)` | sim | cidade |
| `zip_code` | `char(8)` | sim | CEP, **só dígitos** |
| `state` | `char(2)` | sim | UF (SP, RJ…) |
| `phone` | `varchar(11)` | sim | fone, **só dígitos** |
| `email` | `varchar(180)` | sim | email da empresa |
| `logo_path` | `varchar(255)` | sim | caminho relativo (`/uploads/logos/...`) |

Convenção: nomes das colunas em `snake_case` (padrão do projeto). CEP e
fone armazenados sem máscara (regra [form-masked-fields](../../frontend/.agents/skills/mpmweb-ui-patterns/rules/form-masked-fields.md)).

A migration roda em ambiente novo e em ambiente com dados existentes
(empresa demo criada pelo seed). Como tudo é nullable, não há backfill.

## 2. Backend (AdonisJS 6)

### 2.1 Model

`backend/app/models/company.ts` — adicionar 11 colunas:

```ts
@column({ columnName: 'state_registration' })
declare stateRegistration: string | null

@column({ columnName: 'municipal_registration' })
declare municipalRegistration: string | null

@column()
declare address: string | null

@column({ columnName: 'address_number' })
declare addressNumber: string | null

@column()
declare neighborhood: string | null

@column()
declare city: string | null

@column({ columnName: 'zip_code' })
declare zipCode: string | null

@column()
declare state: string | null

@column()
declare phone: string | null

@column()
declare email: string | null

@column({ columnName: 'logo_path' })
declare logoPath: string | null
```

### 2.2 Storage (Drive)

- Instalar `@adonisjs/drive` se ainda não estiver presente.
- Configurar `config/drive.ts` com:
  - `default: 'local'`
  - Disk `local` apontando para `storage/uploads`, com `serveFiles: true` e `visibility: 'public'`.
- Configurar `start/routes.ts` ou hook do Drive para servir `GET /uploads/*` publicamente em dev.
- Adicionar `storage/uploads/` ao `.gitignore`; manter o diretório com `.gitkeep` em `storage/uploads/logos/`.
- Em produção, basta trocar o disk para `s3` no `config/drive.ts`. O serviço não muda.

### 2.3 Validator (VineJS)

`backend/app/validators/company_validators.ts` — campos novos opcionais.

```ts
import vine from '@vinejs/vine'

const BRAZILIAN_STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
] as const

const companyFieldsSchema = {
  legalName: vine.string().trim().minLength(2).maxLength(180),
  tradeName: vine.string().trim().maxLength(180).optional(),
  taxId: vine.string().trim().maxLength(18).optional(),
  stateRegistration: vine.string().trim().maxLength(30).optional(),
  municipalRegistration: vine.string().trim().maxLength(30).optional(),
  address: vine.string().trim().maxLength(180).optional(),
  addressNumber: vine.string().trim().maxLength(20).optional(),
  neighborhood: vine.string().trim().maxLength(120).optional(),
  city: vine.string().trim().maxLength(120).optional(),
  zipCode: vine.string().trim().regex(/^\d{8}$/).optional(),
  state: vine.enum(BRAZILIAN_STATES).optional(),
  phone: vine.string().trim().regex(/^\d{10,11}$/).optional(),
  email: vine.string().trim().email().maxLength(180).optional(),
  isActive: vine.boolean().optional(),
  removeLogo: vine.boolean().optional(),
}

export const createCompanyValidator = vine.compile(
  vine.object({
    ...companyFieldsSchema,
    slug: vine.string().trim().maxLength(80).optional(),
  })
)

export const updateCompanyValidator = vine.compile(
  vine.object({
    ...companyFieldsSchema,
    legalName: companyFieldsSchema.legalName.optional(),
  })
)
```

**`logoPath` não entra no validator** — é controlado pelo serviço a partir do arquivo enviado.

**Mensagens de erro**: hoje o projeto não configura `SimpleMessagesProvider` — usa mensagens padrão do VineJS. Adicionar `.messagesProvider` específico para os validators de empresa traduzindo regex/enum/email para português (ex.: "CEP deve ter 8 dígitos", "UF inválida", "E-mail inválido"). Não trocar o messages provider global nesta tarefa.

### 2.4 Service

`backend/app/services/company_service.ts`:

- `CreateCompanyDTO` e `UpdateCompanyDTO` ganham todos os campos novos como opcionais.
- `update()` mantém o padrão `if (dto.X !== undefined) company.X = dto.X` para cada novo campo.
- `serialize()` retorna todos os campos novos e expõe `logoUrl` (absoluta) calculada a partir de `logo_path` + `env.APP_URL`.
- Métodos novos:
  - `setLogo(tenant, id, file: MultipartFile)`:
    1. `assertVisible`
    2. Valida tipo/tamanho (defesa em profundidade — o controller já valida)
    3. Move o arquivo via `drive.use('local').putStream(...)` ou `file.moveToDisk('logos', { name: '${slug}-${ts}.${ext}' }, 'local')`
    4. Apaga o `logo_path` antigo (best-effort: erro só loga)
    5. Atualiza `company.logoPath`
  - `removeLogo(tenant, id)`:
    1. `assertVisible`
    2. Apaga o arquivo via `drive`
    3. Seta `company.logoPath = null`
- `COMPANY_SORT_COLUMNS` permanece igual — não permitimos ordenar pelos campos novos por enquanto.

### 2.5 Controller

`backend/app/controllers/companies_controller.ts`:

- `store` e `update` aceitam `multipart/form-data`:
  - Lê os campos com `await request.validateUsing(validator)`
  - Lê o arquivo com `const logo = request.file('logo', { size: '2mb', extnames: ['png','jpg','jpeg','webp','svg'] })`
  - Se `logo` existir e `logo.isValid === false`, devolve 422 com mensagem amigável traduzida
  - Cria/atualiza a empresa
  - Se `logo` válido foi enviado, chama `companyService.setLogo(...)` após o save
  - Se body trouxe `removeLogo: true` e não veio `logo` novo, chama `companyService.removeLogo(...)`
- **Atomicidade**:
  - `store`: se o upload falhar depois do create, soft-delete a empresa recém-criada e devolve 500.
  - `update`: o upload de logo é independente; falha de upload **não** desfaz os campos textuais. Mensagem do erro avisa o usuário.

### 2.6 Rotas

`start/routes.ts` permanece idêntico para o CRUD (`/api/companies` …). Acrescenta apenas a rota pública de serving:

```ts
router.get('/uploads/*', '#controllers/uploads_controller.show')
// ou via configuração do Drive route helper, se disponível na versão do Adonis.
```

Permissões existentes (`companies.create`, `companies.update`, `companies.delete`) cobrem as operações de logo — não criamos permissão nova.

## 3. Frontend (React + Vite)

### 3.1 Roteamento

`src/routes/router.tsx`:

- Remove o trigger de modal na listagem.
- Adiciona rotas com `lazy()`:
  - `/companies/new` → `CompanyFormPage` (gate `companies.create`)
  - `/companies/:id/edit` → `CompanyFormPage` (gate `companies.update`)
- Ambas em `<AppLayout>` + `<PermissionRoute>`.

### 3.2 Página do formulário

`src/modules/companies/company-form-page.tsx`:

- `useParams<{ id: string }>()` → `isCreating = id === 'new'`
- `useQuery(['company', companyId, id])` em modo edição; `enabled: !isCreating`
- `form.reset(...)` no `useEffect` quando a query resolve
- Submit monta `FormData` e chama `companiesApi.create({ data, logo, removeLogo })` ou `update(...)`
- Header com `<PageHeader>` + botão "Voltar" linkando para `/companies`
- `<form>` com seções:

**Seção 1 — Identificação** (`grid gap-4 md:grid-cols-2`):
- Razão social (full row), Nome fantasia, CNPJ (mask), Inscrição Estadual, Inscrição Municipal, Switch "Empresa ativa"

**Seção 2 — Endereço** (`grid gap-4 md:grid-cols-6`):
- CEP (mask, col-span-2), UF (Select, col-span-1), Cidade (col-span-3)
- Endereço (col-span-5), Número (col-span-1)
- Bairro (col-span-3)

**Seção 3 — Contato** (`grid gap-4 md:grid-cols-2`):
- Fone (mask), Email

**Seção 4 — Logomarca**:
- `<FileInput>` com preview da logo atual (se existir), botão "Remover" e botão "Selecionar arquivo"
- Quando o usuário clica "Remover", marca `removeLogo: true` no estado do form e esconde a preview
- O arquivo selecionado não é enviado até o submit do form (não há upload separado)

### 3.3 Componentes novos compartilhados

- `src/components/form/file-input.tsx` — input de arquivo genérico:
  - Props: `value: File | null`, `onChange: (file: File | null) => void`, `currentUrl?: string | null`, `onRemoveCurrent?: () => void`, `accept: string`, `maxSize: number` (bytes), `label?: string`
  - Validação client-side: extensão e tamanho; emite toast em caso de violação
  - Preview de imagem (URL atual ou `URL.createObjectURL(file)`); revoga objetURL no cleanup
  - Mora em `components/form/` por reuso futuro (regra [ui-component-reuse](../../frontend/.agents/skills/mpmweb-ui-patterns/rules/ui-component-reuse.md))

- `src/components/form/state-select.tsx` — Select com as 27 UFs hardcoded em uma constante exportada. Recebe `value`/`onChange` no padrão shadcn.

### 3.4 Helpers

`src/lib/masks.ts` — adicionar `maskPhone` exatamente como descrito em [form-masked-fields](../../frontend/.agents/skills/mpmweb-ui-patterns/rules/form-masked-fields.md).

### 3.5 Tipos e API client

`src/types/api.ts`:

```ts
export interface Company {
  id: number
  legalName: string
  tradeName: string | null
  taxId: string | null
  stateRegistration: string | null
  municipalRegistration: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  city: string | null
  zipCode: string | null
  state: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null      // absoluta, montada pelo backend
  slug: string
  isActive: boolean
  createdAt: string | null
}
```

`src/services/companies-api.ts`:

- `CreateCompanyPayload` / `UpdateCompanyPayload` ganham os campos.
- Assinaturas:
  - `create(input: { data: CreateCompanyPayload; logo?: File }): Promise<Company>`
  - `update(id, input: { data: UpdateCompanyPayload; logo?: File; removeLogo?: boolean }): Promise<Company>`
- Implementação interna constrói `FormData`:
  - Cada campo de `data` é appendado individualmente (não como JSON string — facilita o validator do Vine).
  - Booleans viram `'true'`/`'false'`.
  - `null` é omitido.
  - Se `logo` está presente, `formData.append('logo', logo)`.
  - Se `removeLogo` é true, `formData.append('removeLogo', 'true')`.
- Axios automaticamente seta `Content-Type: multipart/form-data` ao detectar FormData.

### 3.6 Listagem

`src/modules/companies/companies-page.tsx`:

- Botão "Nova empresa" vira `<Link to="/companies/new">`; o estado de modal é removido.
- Clique em "Editar" da linha navega para `/companies/{id}/edit`.
- Adicionar coluna de logo à esquerda da razão social: avatar 32px com `<img>` quando há `logoUrl`, fallback é círculo com a inicial.
- `Confirm` de exclusão permanece (regra [crud-confirmation-dialogs](../../frontend/.agents/skills/mpmweb-ui-patterns/rules/crud-confirmation-dialogs.md)).

### 3.7 Arquivo deletado

`src/modules/companies/company-form-dialog.tsx` é apagado depois que a página nova estiver funcional.

## 4. Validação, erros e edge cases

### 4.1 Defesa em camadas

| Validação | Cliente (Zod) | Servidor (Vine) |
|---|---|---|
| Razão social obrigatória, 2–180 | ✓ | ✓ |
| CNPJ 14 dígitos ou vazio | ✓ | ✓ |
| CEP 8 dígitos ou vazio | ✓ | ✓ |
| UF em lista das 27 ou vazio | ✓ | ✓ |
| Fone 10/11 dígitos ou vazio | ✓ | ✓ |
| Email válido ou vazio | ✓ | ✓ |
| Logo: png/jpg/jpeg/webp/svg ≤ 2 MB | ✓ (no FileInput) | ✓ (`request.file` config) |

A API é a autoridade. Mensagens de erro em português.

### 4.2 Atomicidade

- **Criar empresa com logo**: cria → upload. Se upload falha → soft-delete da empresa criada → resposta 500 com mensagem clara.
- **Editar empresa com nova logo**: salva campos → tenta upload. Se upload falha, campos textuais ficam salvos; resposta inclui aviso de falha do upload.
- **Substituir logo**: após save bem-sucedido do novo arquivo, apaga o anterior (best-effort; erro só loga).
- **Remover logo**: campo `removeLogo: true` no payload sem `logo` novo → limpa `logo_path` e apaga arquivo.

### 4.3 Segurança e robustez

- Nome do arquivo é definido pelo backend: `{company.slug}-{timestamp}.{ext}`. O nome enviado pelo cliente é descartado. Evita path traversal e colisão.
- Soft delete da empresa **não** apaga o arquivo de logo (recuperação futura).
- Listagem usa `loading="lazy"` nas `<img>` para evitar carga em massa.

## 5. Permissões

Reaproveitamos as permissões existentes (`companies.create`, `companies.update`, `companies.delete`). Não há permissão dedicada para upload de logo.

## 6. Migração e seed

- A migration é puramente aditiva — empresa demo do `main_seeder.ts` continua válida com os campos nulos.
- Opcional: o seed pode preencher dados-exemplo da empresa demo para facilitar QA. Não é requisito.

## 7. Fora de escopo (YAGNI)

- ViaCEP — descartado nesta iteração.
- Redimensionamento server-side da logo.
- Versionamento ou histórico de logos.
- Multiplas logos por empresa.
- Endpoint dedicado de upload.
- Crop client-side da logo.
- Compressão automática.
- Permissão dedicada para upload.
- Migração de dados existentes (não há dados a migrar).
- Tornar colunas novas ordenáveis na listagem.
- Página de detalhe somente-leitura (a página de edição cobre).

## 8. Resumo dos arquivos tocados

### Backend
- **Novo**: `database/migrations/{timestamp}_add_address_contact_logo_to_companies.ts`
- **Novo (se faltar)**: `config/drive.ts`
- **Novo (se necessário)**: `app/controllers/uploads_controller.ts` (rota pública de serving)
- **Editado**: `app/models/company.ts`
- **Editado**: `app/validators/company_validators.ts`
- **Editado**: `app/services/company_service.ts`
- **Editado**: `app/controllers/companies_controller.ts`
- **Editado**: `start/routes.ts`
- **Editado**: `.gitignore`
- **Novo**: `storage/uploads/logos/.gitkeep`

### Frontend
- **Novo**: `src/modules/companies/company-form-page.tsx`
- **Novo**: `src/components/form/file-input.tsx`
- **Novo**: `src/components/form/state-select.tsx`
- **Editado**: `src/modules/companies/companies-page.tsx`
- **Editado**: `src/routes/router.tsx`
- **Editado**: `src/types/api.ts`
- **Editado**: `src/services/companies-api.ts`
- **Editado**: `src/lib/masks.ts`
- **Deletado**: `src/modules/companies/company-form-dialog.tsx`

## 9. Critérios de pronto

- [ ] `npm run typecheck` passa no backend e no frontend
- [ ] Migration sobe e desce limpa em ambiente vazio e em ambiente com a empresa demo
- [ ] Criar empresa nova com todos os campos preenchidos + logo SVG funciona
- [ ] Criar empresa só com razão social (sem logo) funciona
- [ ] Editar empresa: trocar logo apaga a antiga do disco
- [ ] Editar empresa: remover logo limpa a coluna e apaga o arquivo
- [ ] Listagem mostra avatar 32px com fallback de inicial
- [ ] Form responsivo: testar em 1280, 1024, 768, 375
- [ ] Upload > 2 MB rejeitado no cliente com toast amigável
- [ ] Upload de tipo inválido rejeitado no cliente
- [ ] CNPJ, CEP, fone salvos no banco sem máscara; renderizados com máscara na UI

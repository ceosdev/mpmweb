# Estado da aplicação — MPM Web

**Snapshot**: 2026-05-23
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

## Esquema do banco (12 tabelas)

| Tabela | Resumo |
| --- | --- |
| `companies` | Tenants. Soft delete. Identificação + IE/IM + endereço + contato + logo. |
| `roles` | Perfis (ROOT, ADMIN, OPERADOR). |
| `permissions` | Catálogo de slugs `<module>.<action>`. |
| `users` | Usuários da plataforma. Senha hasheada. Soft delete. `is_root` libera curinga `*`. |
| `memberships` | Vínculo `user × company` com `role` + `extra_permissions`. Soft delete. |
| `role_permissions` | Permissões padrão por role. |
| `membership_permissions` | Permissões extras por vínculo. |
| `payment_types` | Tipos de pagamento por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. |
| `document_types` | Tipos de documento por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `units_of_measure` | Unidades de medida por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `service_groups` | Grupos de serviço por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |
| `product_groups` | Grupos de produto por empresa. **Hard delete**. FK `company_id` com `RESTRICT`. Multitenant. |

Colunas atuais de `companies` (após migration `1779413112478`):
`id, legal_name, trade_name, tax_id, state_registration, municipal_registration,
address, address_number, neighborhood, city, zip_code (char 8), state (char 2),
phone, email, logo_path, slug, is_active, created_at, updated_at, deleted_at`.

## Módulos entregues

- **Auth** — login, refresh, logout, forgot/reset password (token JWT stateless de 30 min para reset).
- **Multitenant** — header `x-company-id` define empresa ativa; `TenantContext` aplica permissões + escopo de dados.
- **RBAC** — catálogo em `backend/app/abilities/catalog.ts`. Slugs `dashboard.*`, `companies.*`, `users.*`, `permissions.*`. ROOT bypassa tudo.
- **Dashboard** — contagens (usuários, empresas, roles, permissions).
- **Users (CRUD)** — listagem paginada, modal de form, papel + permissões extras.
- **Companies (CRUD)** — listagem paginada com avatar de logo; formulário em **rota dedicada** (`/companies/new` e `/companies/:id/edit`) com seções Identificação, Endereço, Contato, Logomarca. Upload de logo via multipart único, atomicidade no create (rollback se upload falhar).
- **Permissions** — visualização do catálogo e edição por role.
- **Payment Types (CRUD)** — primeiro CRUD do padrão "simples" (descrição + status, multitenant, hard delete, modal). Aplicação canônica da rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Tipos de documento (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Unidades de medida (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Grupos de serviço (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).
- **Grupos de produto (CRUD)** — CRUD simples padrão. Ver rule [`simple-crud-pattern`](frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Rotas

### Backend (`/api`)

Públicas: `POST /auth/{login,refresh,forgot-password,reset-password}`.
Autenticadas: `GET /auth/me`, `POST /auth/logout`.
Autenticadas + empresa ativa (cada uma com gate de permissão):
- `GET /me/context`
- `GET /dashboard`
- `GET|POST /users`, `GET|PUT|DELETE /users/:id`
- `GET|POST /companies`, `GET|PUT|DELETE /companies/:id` *(POST/PUT aceitam multipart com `logo` + `removeLogo`)*
- `GET /roles`, `GET /permissions`
- `GET|POST /payment-types`, `GET|PUT|DELETE /payment-types/:id`
- `GET|POST /document-types`, `GET|PUT|DELETE /document-types/:id`
- `GET|POST /units-of-measure`, `GET|PUT|DELETE /units-of-measure/:id`
- `GET|POST /service-groups`, `GET|PUT|DELETE /service-groups/:id`
- `GET|POST /product-groups`, `GET|PUT|DELETE /product-groups/:id`

Estáticas: `GET /uploads/*` (servidas pelo `@adonisjs/drive`, disk `fs` em
`backend/storage/uploads/`).

### Frontend

Públicas: `/login`, `/forgot-password`, `/reset-password`.
Autenticadas: `/select-company`.
Protegidas (em `AppLayout`): `/` (dashboard), `/users`, `/companies`,
`/companies/new`, `/companies/:id/edit`, `/permissions`, `/payment-types`,
`/document-types`, `/units-of-measure`, `/service-groups`, `/product-groups`.

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

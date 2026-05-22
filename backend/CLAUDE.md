# CLAUDE.md — Backend (API AdonisJS)

API REST do MPM Web. AdonisJS 6 (LTS) + TypeScript + PostgreSQL + JWT.
Veja o `CLAUDE.md` raiz para multiempresa e RBAC em nível de plataforma.

## Como rodar

```bash
cp .env.example .env        # ajuste DB_* para o PostgreSQL local
npm install
node ace migration:run
node ace db:seed
npm run dev                 # http://localhost:3333
npm run typecheck           # checagem de tipos
```

## Camadas e responsabilidades

```txt
HTTP → Middleware → Controller → Service → Repository → Model (Lucid)
```

| Pasta                | Responsabilidade                                              |
| -------------------- | ------------------------------------------------------------- |
| `app/controllers`    | Entrada HTTP. Valida o payload e delega ao service. Sem regra de negócio. |
| `app/services`       | Regras de negócio e casos de uso. Orquestram repositories.    |
| `app/repositories`   | Acesso a dados. Encapsulam queries Lucid e filtram soft delete. |
| `app/models`         | Modelos Lucid (mapeamento de tabelas e relações).             |
| `app/middleware`     | `auth` (JWT), `tenant` (empresa ativa), `permission` (RBAC).  |
| `app/validators`     | Schemas VineJS por módulo.                                    |
| `app/abilities`      | `catalog.ts` — catálogo de permissões e perfis (fonte única). |
| `app/exceptions`     | `AppException` e subtipos (status HTTP + código).             |
| `contracts`          | Augmentation do `HttpContext` (`currentUser`, `tenant`).      |
| `database/migrations`| Schema do banco.                                              |
| `database/seeders`   | `main_seeder.ts` — RBAC + ROOT + empresa demo (idempotente).  |

Regra: controllers finos, services com a lógica, repositories só com query.
Evite arquivos gigantes e lógica espalhada.

## Autenticação (JWT)

`app/services/jwt_service.ts` assina/verifica 3 tipos de token:

- `access` (15 min) — autentica as requisições.
- `refresh` (7 dias) — gera novos access tokens em `POST /api/auth/refresh`.
- `password_reset` (30 min) — recuperação de senha **stateless** (sem tabela).

`auth_service.ts` cuida de login, refresh e reset. A senha é hasheada por um
hook `@beforeSave` no model `User` (serviço `hash` do AdonisJS, scrypt).

> Não há mailer configurado: o token de reset é apenas logado. Em produção,
> conecte um mailer para entregá-lo.

## Multi-tenant e autorização

Pipeline de middleware nas rotas protegidas:

1. `auth` — valida o Bearer token, carrega o `User` em `ctx.currentUser`.
2. `tenant` — lê `x-company-id`, valida o acesso e monta `ctx.tenant`
   (`TenantContext`: empresa, vínculo, `Set` de permissões, `isRoot`).
3. `permission('slug')` — exige uma permissão específica na rota.

`PermissionService.buildContext()` resolve as permissões efetivas:
`role_permissions ∪ membership_permissions`, ou curinga `*` para ROOT.

Toda query de negócio deve ser escopada por `tenant.company.id`.

## Rotas

Definidas em `start/routes.ts`, todas sob `/api`:

- Públicas: `POST /api/auth/{login,refresh,forgot-password,reset-password}`
- Autenticadas: `GET /api/auth/me`, `POST /api/auth/logout`
- Autenticadas + empresa ativa: `GET /api/me/context`, e os recursos
  `users`, `companies`, `roles`, `permissions`, `dashboard` — cada um
  protegido por uma permissão via `middleware.permission(...)`.

## Convenções

- Idioma: **código em inglês**; mensagens de erro ao usuário em português.
- Imports usam os aliases do `package.json` (`#services/*`, `#models/*`, …).
- Sem enums TS desnecessários; preferir union types e objetos const.
- Soft delete: setar `deleted_at`; repositories filtram com `whereNull`.
- Novas permissões: adicionar em `app/abilities/catalog.ts` e rodar o seed.
- Novo módulo CRUD: criar migration → model → repository → service →
  validator → controller → rota com a permissão correspondente.

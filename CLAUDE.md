# CLAUDE.md — Visão global da plataforma

Guia raiz do monorepo **MPM Web**. Leia também `backend/CLAUDE.md` e
`frontend/CLAUDE.md` para detalhes de cada aplicação.

## O que é

Plataforma corporativa **multiempresa (multi-tenant)** para gestão empresarial
interna. Uso inicial: ~15 usuários internos, baixa concorrência.

Princípios de arquitetura: **simplicidade, produtividade, manutenção fácil,
segurança e segregação de dados**. Evitar overengineering.

NÃO usar (decisão consciente): microserviços, filas, websocket, jobs em
background, Kubernetes, event-driven, CQRS, DDD complexo.

## Convenção de idioma (importante)

- **Código em inglês**: tabelas, colunas, modelos, classes, variáveis, rotas,
  campos de JSON da API. Slugs de permissão/perfil também em inglês.
- **Português apenas nos textos exibidos ao usuário** no frontend, e nos campos
  `name`/`description` de perfis e permissões (são conteúdo mostrado na UI).
- Mensagens de erro retornadas pela API são exibidas ao usuário → português.

## Monorepo

```txt
mpmweb/
├── backend/    # API AdonisJS 6 + PostgreSQL
└── frontend/   # SPA React + Vite
```

Sem Docker: o PostgreSQL é a instância local da máquina do desenvolvedor.

## Modelo multiempresa

Um **User** pertence à plataforma e se relaciona com uma ou mais **Company**
através de **Membership** (o vínculo):

```txt
User  ←→  Membership  ←→  Company
                │
                ├─ role        (perfil naquela empresa)
                └─ extraPermissions
```

A **empresa ativa** é escolhida após o login e enviada em toda requisição no
header `x-company-id`. Ela controla: dados exibidos, permissões, menu e acesso
às funcionalidades. Trocar de empresa re-resolve as permissões.

### Segregação de dados

Toda entidade relevante pertence a uma empresa. Toda query é filtrada pela
empresa ativa (`TenantContext`). Um usuário nunca enxerga dados de outra
empresa — exceto o ROOT, que tem acesso irrestrito.

## RBAC — controle de acesso

Três perfis (roles) iniciais:

| Role     | Descrição                                                          |
| -------- | ------------------------------------------------------------------ |
| ROOT     | Master da plataforma. Acesso irrestrito; cria empresas; entra em qualquer empresa. |
| ADMIN    | Administra a própria empresa: usuários, permissões, dados.         |
| OPERADOR | Usuário operacional; acessa apenas o que lhe foi permitido.        |

O acesso **não depende apenas do perfil**. As permissões efetivas de um usuário
em uma empresa são:

```txt
permissões = permissões do role (role_permissions)
           ∪ permissões extras do vínculo (membership_permissions)
```

ROOT (`users.is_root = true`) recebe o curinga `*` e passa por qualquer
verificação.

### Catálogo de permissões

Fonte única da verdade: `backend/app/abilities/catalog.ts`. Slug no formato
`<module>.<action>` (ex.: `users.create`). Módulos atuais: `dashboard`,
`companies`, `users`, `permissions`.

As permissões controlam páginas, rotas, menus, botões e ações específicas — no
backend (middleware/policies) e no frontend (componente `Can`, menu dinâmico).

## Integração frontend ↔ backend

- API REST sob `/api`. JSON em inglês.
- Autenticação: JWT Bearer (`Authorization: Bearer <accessToken>`).
- Empresa ativa: header `x-company-id`.
- O frontend nunca confia só na UI — toda regra é reforçada pela API.
- Endpoint `GET /api/me/context` devolve perfil + permissões da empresa ativa;
  o frontend usa isso para montar o menu dinâmico e liberar ações.

## Banco de dados

7 tabelas: `companies`, `roles`, `permissions`, `users`, `memberships`,
`role_permissions`, `membership_permissions`. Timestamps em todas; soft delete
(`deleted_at`) em `companies`, `users` e `memberships`.

## Usuário ROOT inicial (seed)

`carlossantana.desenv@gmail.com` / `12345678` — criado por
`backend/database/seeders/main_seeder.ts` junto da empresa demo.

# Arquitetura — MPM Web

Documento de decisões. Para o dia a dia, veja os `CLAUDE.md`.

## Objetivo

Plataforma corporativa multiempresa para ~15 usuários internos. Prioridade:
simplicidade, manutenção fácil, baixo custo e segurança — sem overengineering.

## Visão geral

```txt
┌────────────┐   HTTPS / JSON    ┌────────────────┐      ┌──────────────┐
│  Frontend  │ ────────────────▶ │   Backend API  │ ───▶ │  PostgreSQL  │
│  React SPA │   Bearer JWT      │   AdonisJS 6   │      │              │
│  (Vercel)  │   x-company-id    │   (Railway)    │      │  (Railway)   │
└────────────┘                   └────────────────┘      └──────────────┘
```

## Decisões principais

### 1. Monorepo simples, sem Docker

Duas pastas (`backend`, `frontend`), cada uma com o seu `package.json`. Em
desenvolvimento usa-se o PostgreSQL local da máquina. Menos partes móveis.

### 2. Autenticação JWT stateless

Access token (15 min) + refresh token (7 dias), assinados com `jsonwebtoken`.
Sem sessão em banco. O frontend guarda os tokens em `localStorage` e renova o
access token de forma transparente no interceptor do axios.

A recuperação de senha também é stateless: o token de reset é um JWT curto
(30 min) — sem necessidade de tabela auxiliar.

### 3. Multi-tenant por linha (shared schema)

Todas as empresas no mesmo banco/schema. Cada entidade relevante referencia uma
empresa. O `TenantContext` (resolvido por middleware a partir do header
`x-company-id`) garante que toda query seja escopada. Simples e suficiente para
a escala atual; evita a complexidade de schema-por-tenant.

### 4. RBAC híbrido (perfil + permissões extras)

O acesso não depende só do perfil. As permissões efetivas combinam as do perfil
(`role_permissions`) com as permissões extras do vínculo
(`membership_permissions`). Assim um usuário pode receber uma capacidade pontual
sem trocar de perfil. O catálogo de permissões é a fonte única da verdade
(`backend/app/abilities/catalog.ts`).

### 5. Camadas no backend

`Controller → Service → Repository → Model`. Controllers finos (HTTP +
validação), services com a regra de negócio, repositories isolando as queries.
Mantém os arquivos pequenos e testáveis sem abstrações prematuras.

### 6. Estado no frontend

Estado de servidor no TanStack Query; sessão e tema em contextos. O RBAC da UI
espelha o do backend, mas a API é sempre a autoridade final.

## Modelo de dados

```txt
companies ─┬─< memberships >─┬─ users
           │                 └─ roles ─< role_permissions >─ permissions
           │                 └─< membership_permissions >─ permissions
```

7 tabelas. Timestamps em todas; soft delete em `companies`, `users`,
`memberships`.

## Caminho de evolução saudável

- Novos módulos seguem o mesmo fluxo de camadas e ganham permissões no catálogo.
- Quando houver e-mail, conectar um mailer ao fluxo de recuperação de senha.
- Se o volume crescer, os índices já existentes cobrem as buscas principais;
  paginação já é padrão nas listagens.

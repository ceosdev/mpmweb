# MPM Web

Plataforma corporativa multiempresa (multi-tenant) para gestão empresarial
interna. Monorepo simples com backend (AdonisJS) e frontend (React).

> **Convenção de idioma:** todo o código — tabelas, colunas, modelos, variáveis —
> é escrito em **inglês**. Apenas os textos exibidos ao usuário no frontend são
> em **português**.

## Stack

| Camada    | Tecnologias                                                        |
| --------- | ------------------------------------------------------------------ |
| Frontend  | React, Vite, TypeScript, TailwindCSS, shadcn/ui, TanStack Query, React Hook Form, Zod |
| Backend   | AdonisJS 6 (LTS), TypeScript, PostgreSQL, autenticação JWT          |
| Banco     | PostgreSQL (instância local em desenvolvimento)                    |
| Hospedagem| Frontend → Vercel · Backend + PostgreSQL → Railway                 |

## Estrutura do monorepo

```txt
mpmweb/
├── CLAUDE.md            # visão global, regras de negócio, multiempresa, RBAC
├── README.md
├── .env.example
├── docs/                # documentação de arquitetura
├── backend/             # API AdonisJS  (CLAUDE.md próprio)
└── frontend/            # SPA React     (CLAUDE.md próprio)
```

## Pré-requisitos

- Node.js 22+
- PostgreSQL rodando localmente

## Como rodar (desenvolvimento)

### 1. Backend

```bash
cd backend
cp .env.example .env          # ajuste as credenciais do PostgreSQL
npm install
node ace migration:run        # cria as tabelas
node ace db:seed              # popula RBAC + usuário ROOT + empresa demo
npm run dev                   # http://localhost:3333
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## Acesso inicial

Após rodar o seed, use o usuário ROOT:

- **E-mail:** `carlossantana.desenv@gmail.com`
- **Senha:** `12345678`

O seed também cria a empresa **Empresa Demo** já vinculada a esse usuário.

## Funcionalidades do bootstrap

- Autenticação por e-mail/senha com JWT (access + refresh token).
- Recuperação de senha (token stateless; o link aparece no console em dev).
- Multiempresa: seleção e troca de empresa ativa, com contexto global.
- RBAC: perfis (ROOT/ADMIN/OPERADOR) + permissões extras por vínculo.
- Menu dinâmico e botões/ações controlados por permissão.
- CRUD de Usuários e Empresas; Dashboard; tela de Permissões.
- Layout administrativo com sidebar retrátil, header e dark mode.

## Documentação

- [`CLAUDE.md`](./CLAUDE.md) — arquitetura geral, multiempresa e RBAC.
- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — arquitetura da API.
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — padrões do frontend.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — decisões de arquitetura.

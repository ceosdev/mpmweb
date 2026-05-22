# CLAUDE.md — Frontend (SPA React)

SPA do MPM Web. React + Vite + TypeScript + TailwindCSS + shadcn/ui.
Veja o `CLAUDE.md` raiz para multiempresa e RBAC em nível de plataforma.

## Como rodar

```bash
cp .env.example .env        # VITE_API_URL
npm install
npm run dev                 # http://localhost:5173
npm run build               # tsc -b && vite build
```

## Estrutura

```txt
src/
├── app/           # App raiz (composição dos providers + router)
├── components/    # componentes compartilhados
│   └── ui/        # primitivos shadcn/ui (não editar à toa)
├── modules/       # telas por domínio (auth, dashboard, users, companies, permissions)
├── services/      # cliente HTTP (axios) + módulos de API por domínio
├── hooks/         # hooks reutilizáveis
├── providers/     # contextos globais (theme, query, auth)
├── layouts/       # AppLayout (sidebar+header) e AuthLayout
├── routes/        # router + guards de rota
├── permissions/   # helpers de permissão, menu dinâmico, componente <Can>
├── types/         # tipos do contrato da API
├── lib/           # utilitários (cn, formatação, storage, erros)
└── index.css      # Tailwind v4 + design tokens (claro/escuro)
```

## Estado global

Três providers, nesta ordem (`app/app.tsx`):

1. `ThemeProvider` — tema claro/escuro (classe `.dark` no `<html>`).
2. `QueryProvider` — TanStack Query (cache de dados do servidor).
3. `AuthProvider` — sessão, empresas, empresa ativa e `TenantContext`.

`useAuth()` expõe `user`, `companies`, `activeCompanyId`, `tenant`, e as ações
`login`, `selectCompany`, `logout`, `refreshContext`.

- **Estado de servidor** (listas, registros) → TanStack Query (`useQuery`/`useMutation`).
- **Estado de sessão/UI global** → contexto (`AuthProvider`, `ThemeProvider`).
- Não duplicar dados de servidor em `useState`.

> As `queryKey` incluem `tenant.companyId` para que o cache seja invalidado ao
> trocar de empresa.

## Permissões na UI

A UI espelha o RBAC do backend (que é sempre a autoridade final):

- `usePermissions()` → `can(slug)`, `canAny([...])`, `isRoot`, `role`.
- `<Can permission="users.create">…</Can>` esconde botões/ações.
- `permissions/menu.ts` define o menu; a sidebar filtra pelos itens permitidos
  → **menu dinâmico** por empresa ativa.
- `routes/guards.tsx`: `PublicRoute`, `AuthenticatedRoute`, `ProtectedRoute`,
  `PermissionRoute` — escalonam público → autenticado → empresa → permissão.

## Consumo da API

- `services/api-client.ts`: instância axios única. Anexa automaticamente o
  `Authorization: Bearer` e o header `x-company-id`. Em `401`, faz refresh do
  token uma vez e repete a requisição.
- Um módulo de API por domínio (`auth-api.ts`, `users-api.ts`, …) — só chamadas
  HTTP tipadas; nada de lógica de UI.

## UI / Design system

- Inspiração visual: **Linear.app** — minimalista, tipografia limpa, espaçamento
  consistente, sidebar elegante, animações sutis.
- Componentes base: **shadcn/ui** em `components/ui` (estilo new-york).
- Estilização só com classes Tailwind; cores via tokens (`bg-background`,
  `text-muted-foreground`, …) — nunca cores fixas, para o dark mode funcionar.
- `cn()` (`lib/utils.ts`) para compor classes.

## Convenções

- Idioma: **código em inglês**; **textos visíveis em português**.
- Formulários: React Hook Form + Zod (`zodResolver`).
- Feedback ao usuário: `toast` (sonner). Erros de API via `getErrorMessage()`.
- Arquivos em kebab-case; um componente/responsabilidade por arquivo.
- Nova tela: criar em `modules/<domínio>/`, registrar em `routes/router.tsx`,
  e adicionar ao `permissions/menu.ts` se for item de menu.

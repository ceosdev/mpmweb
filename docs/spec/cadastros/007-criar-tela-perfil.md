# Spec: Criar tela de perfis

## Problema

Hoje a tabela `roles` é **global** e tem três registros seedados (ROOT, ADMIN,
OPERADOR). Esse modelo não cobre o que o produto precisa:

1. Cada empresa precisa **criar os perfis que ela quiser** ("Administrador",
   "Gerente de loja", "Vendedor", "Operador") com a combinação de permissões
   que fizer sentido para o negócio dela.
2. Perfis criados em uma empresa não podem aparecer/vazar para outra.
3. Não há razão para a plataforma impor um perfil "Admin" ou "Operador" — são
   apenas nomes que cada empresa decide se quer ou não.

O único perfil que **a plataforma precisa controlar** é o **ROOT**, que é o
master da plataforma e tem acesso irrestrito a todas as empresas.

## Solução proposta

- Tornar `roles` **multitenant** com `company_id`. **ROOT continua global**
  (`company_id NULL`, `is_system=true`) e **inviolável**: nunca aparece na
  UI, nunca é editado, nunca é excluído.
- **Eliminar** os registros globais de ADMIN e OPERADOR (e suas entradas no
  catálogo `ROLES`). Cada empresa nasce **sem nenhum perfil** e o cliente
  cria os dele.
- Criar tela `/roles` (label "Perfis") com listagem + formulário em **rota
  dedicada** (`/roles/new`, `/roles/:id/edit`). Não cabe no padrão simple-CRUD
  porque o formulário tem um seletor de permissões agrupado por módulo.
- Adicionar `is_active` em `roles` para ativar/desativar sem excluir.
- Criar 4 permissões `roles.view/create/edit/delete` no catálogo (não são
  atribuídas a ninguém por seed — quem atribui é o ROOT para os perfis das
  empresas, ou outro usuário que já tenha `roles.edit`).

A tela existente `/permissions` (read-only) é mantida como consulta do
catálogo cru de permissões — não é substituída.

## Comportamento esperado

### Fluxo feliz
- Usuário com `roles.view` clica em "Perfis" no menu.
- Vê a listagem paginada (20/página, server-side) com colunas **Nome**,
  **Descrição**, **Permissões** (contador) e **Status** (badge
  "Ativa"/"Inativa"). Ordenada por nome asc. Busca por nome com debounce
  (padrão dos outros CRUDs).
- Clica em "Novo perfil" (gated por `roles.create`) → navega para `/roles/new`.
- Preenche **nome** ("Vendedor"), **slug** auto-gerado a partir do nome
  ("vendedor", editável), **descrição** opcional.
- Marca as **permissões** agrupadas por módulo (Dashboard, Empresas, Usuários,
  Tipos de pagamento, Grupos de produto, …). Cada card de módulo tem um
  checkbox tristate "marcar/desmarcar todas" e contador `X/Y`.
- Clica em "Salvar". Validação: `trim` no nome (1–80 chars), slug em
  kebab-case (1–40 chars, regex `^[a-z][a-z0-9_-]*$`), unique por empresa,
  slug não pode ser `root` (reservado).
- Volta para `/roles`, toast de sucesso, listagem atualizada.

### Fluxos alternativos
- **Editar perfil**: ícone editar (gated `roles.edit`) → `/roles/:id/edit`.
  Pode alterar nome, slug, descrição, status e permissões.
- **Excluir perfil**: `ConfirmDialog`. Se houver memberships ligados ao perfil
  (FK `memberships.role_id` é `RESTRICT`), backend devolve **409** com
  `"Não é possível excluir este perfil porque há usuários atrelados a ele."`.
- **Desativar perfil**: editar e desmarcar o switch. Inativos seguem visíveis
  na listagem com badge "Inativa" para permitir reativação. Memberships
  vigentes com perfil inativo continuam funcionando (o backend não invalida
  retroativamente); a tela futura de usuários é que filtra inativos do select
  ao atribuir.
- **ROOT na UI**: simplesmente **não aparece** em lugar nenhum. A listagem é
  filtrada no backend para esconder `is_system=true`. Tentar editar/excluir
  por ID via API retorna **422**.

### Regras de negócio
- **Multitenant**: cada empresa vê apenas os próprios perfis. ROOT é o único
  com `company_id NULL`, e nunca aparece em nenhuma listagem ou retorno
  individual da API de roles.
- **ROOT é inviolável**: nem editar, nem excluir, nem desativar, em nenhuma
  hipótese, nem mesmo via API. Backend retorna 422 se forçar.
- **Demais perfis**: CRUD completo dentro da empresa ativa, sem distinção
  especial. "Administrador", "Operador" etc. são apenas nomes — não têm
  significado interno na plataforma.
- **Unique**: `(company_id, slug)` único. PostgreSQL trata NULL ≠ NULL no
  unique, então o ROOT global (NULL) não conflita com slugs por empresa.
- **Slug reservado**: `root` não pode ser usado em nenhum perfil de empresa
  (validador rejeita).
- **Hard delete** (sem `deleted_at`), barrado pelo FK de memberships quando
  há vínculo.
- **Catálogo de permissões**: o seletor lista **todas** as permissões do
  catálogo, sem restrição. Se o cliente quer dar `companies.delete` a um
  perfil dele, é decisão dele.

## Fora de escopo
- Atribuir um perfil a um usuário (continua na tela de usuários ao criar/editar
  membership).
- Botão "duplicar perfil" para clonar um existente.
- Auto-criação de algum perfil padrão ao criar empresa — empresa nasce vazia
  de perfis (o ROOT entra e cria os primeiros).
- Histórico/auditoria de mudanças em perfis ou permissões.
- Filtros (por status, por contagem de permissões) na listagem.
- Tela de relacionamento usuário ↔ empresa ↔ perfil em batch (vem em spec
  futura, possivelmente como multi-select na própria tela de usuários).
- Substituir a tela `/permissions` read-only.

## Decisões técnicas

### Backend

- **Migration nova** `alter_roles_add_company_and_is_active`:
  - `ALTER TABLE roles ADD COLUMN company_id INTEGER NULL REFERENCES companies(id) ON DELETE CASCADE`.
  - `ALTER TABLE roles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true`.
  - Dropar o unique global de `slug`.
  - Criar unique `(company_id, slug)`.
  - **Data migration**: deletar as linhas `slug IN ('admin', 'operator')` do
    `roles` (e os respectivos `role_permissions` em cascata pelo FK). Como o
    único membership seedado aponta para ROOT, o `RESTRICT` do FK em
    `memberships.role_id` não dispara em ambiente limpo. **Se houver
    memberships pré-existentes apontando para `admin`/`operator`** (cenário de
    dev/staging), a migration **aborta** com mensagem explicativa pedindo
    limpeza manual antes — não há regra de produto para "para onde mover"
    esses memberships, então é decisão humana.
  - `down`: lançar exceção explicando que a migration não é reversível.

- **Catálogo** (`backend/app/abilities/catalog.ts`):
  - Adicionar as 4 permissões `roles.view/create/edit/delete`.
  - **Remover** `ROLES.admin` e `ROLES.operator` do objeto `ROLES`. Manter só
    `ROLES.root` com `WILDCARD`.
  - Ajustar o tipo `RoleSlug` para `'root'` apenas.

- **Seeder** (`main_seeder.ts`):
  - Continuar populando o catálogo de permissões.
  - Continuar criando apenas o perfil ROOT (`company_id NULL`, `is_system=true`)
    e o usuário master + membership ROOT na empresa demo.
  - **Não criar mais** ADMIN/OPERADOR — nem globais, nem por empresa.

- **Fluxo de criação de empresa** (`company_service.create`): **inalterado**.
  A empresa nasce sem nenhum perfil. Cabe ao ROOT (ou outro usuário com
  `roles.create` futuramente) entrar na empresa e cadastrar os perfis.

- **Camadas**: `Role` model (já existe — adicionar `companyId` e `isActive`)
  → `role_repository` → `role_service` → `role_validator` (VineJS) →
  `roles_controller` → rota.

- **Endpoints** sob `/api/roles` (`middleware.tenant()` + permissão):
  - `GET /api/roles` — listagem paginada (20/página) com `search`, `sort`,
    `direction`. Escopo: `where('company_id', tenant.company.id)`. ROOT
    user vê o mesmo (ROOT-role nunca entra na listagem). Gate: `roles.view`.
  - `POST /api/roles` — cria perfil na empresa ativa (`is_system=false`,
    `company_id=tenant.company.id`). Gate: `roles.create`.
  - `GET /api/roles/:id` — detalha com `permissions[]`. 404 se `is_system=true`
    ou se for de outra empresa.
  - `PUT /api/roles/:id` — atualiza. ROOT/`is_system=true` → 422. Aceita
    `permissions: number[]` para reescrever o vínculo. Gate: `roles.edit`.
  - `DELETE /api/roles/:id` — exclui. ROOT/`is_system=true` → 422. FK
    violation → 409 com mensagem amigável. Gate: `roles.delete`.

- **Lista enxuta para selects** (consumida hoje pela tela de usuários e pela
  `/permissions` read-only): se algum endpoint já devolve "todos os roles para
  alimentar um select", esse endpoint passa a devolver **apenas os ativos da
  empresa**, sem ROOT, sem `is_system=true`. Validar na implementação
  exatamente quais consumidores existem e adaptar.

- **Validator** (VineJS, mensagens pt-BR):
  - `name`: required, trim, min 1, max 80.
  - `slug`: required, regex `^[a-z][a-z0-9_-]*$`, max 40, **diferente de
    `root`**, unique `(company_id, slug)` validado no service.
  - `description`: optional, trim, max 255.
  - `is_active`: boolean, default `true`.
  - `permissions`: array de IDs numéricos, todos existentes no catálogo.

### Frontend

- Rotas em `routes/router.tsx`:
  - `/roles` → listagem, gate `roles.view`.
  - `/roles/new` → form, gate `roles.create`.
  - `/roles/:id/edit` → form, gate `roles.edit`.
- Item no menu (`permissions/menu.ts`) com ícone `Shield` (lucide-react) e
  label **"Perfis"**.
- Página `src/modules/roles/roles-page.tsx`:
  - Reusa `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`,
    `ConfirmDialog`, `Can`, `Skeleton`, `Badge` e o input de busca padrão.
  - Coluna **Permissões**: badge cinza com o contador (`12 permissões`).
  - Botões da linha: editar (gated `roles.edit`), excluir (gated
    `roles.delete`) sem nenhuma exceção de UI — ROOT simplesmente não chega
    aqui.
- Página `src/modules/roles/roles-form-page.tsx` (rota dedicada, esqueleto
  semelhante a `/companies/new`):
  - Seção **Identificação**: `name` (Input), `slug` (Input com botão
    "Sincronizar com o nome" que regenera kebab-case), `description`
    (Textarea).
  - Seção **Status**: Switch `is_active`.
  - Seção **Permissões**: um `Card` por módulo, listando as permissões com
    `Checkbox`. Cabeçalho do card com checkbox tristate
    (todas/algumas/nenhuma) e contador `X/Y`. Catálogo vem de
    `catalog-api.permissions()`.
  - Validação Zod espelhando o backend.
- API client: `src/services/roles-api.ts` com `list`, `get`, `create`,
  `update`, `delete`.
- Tipo `Role` em `src/types/api.ts`: adicionar `companyId: number | null`,
  `isActive: boolean`, `permissions?: Permission[]`.
- `queryKey` inclui `tenant.companyId`.

## Critérios de aceite
- [ ] Migration adiciona `company_id` e `is_active`, remove os registros
      `admin` e `operator` globais e os `role_permissions` correspondentes.
      ROOT permanece intocado.
- [ ] A migration aborta com mensagem clara se encontrar memberships
      apontando para os registros que ela precisa remover.
- [ ] Após a migration, o usuário master (`carlossantana.desenv@gmail.com`)
      segue como ROOT na empresa demo, e a empresa demo não tem nenhum outro
      perfil cadastrado.
- [ ] Catálogo traz `roles.view/create/edit/delete`. Definições de
      `ROLES.admin` e `ROLES.operator` removidas; o tipo `RoleSlug` reduzido
      para `'root'`.
- [ ] Criar uma nova empresa pela tela `/companies/new` resulta em zero
      perfis para essa empresa.
- [ ] `GET /api/roles` devolve paginado, com busca por nome e ordenação,
      escopado pela empresa ativa, e nunca inclui ROOT.
- [ ] Listagem `/roles` mostra os perfis da empresa ativa; ROOT nunca
      aparece.
- [ ] Criar perfil com `slug = "root"` é rejeitado com mensagem clara em
      pt-BR.
- [ ] Slug é único por empresa: dois "vendedor" na mesma empresa falha; em
      empresas diferentes funciona.
- [ ] ROOT não pode ser editado, excluído ou desativado nem mesmo via API —
      todas as ações retornam 422.
- [ ] Excluir perfil em uso devolve 409 em pt-BR.
- [ ] Selecionar permissões no form persiste em `role_permissions`. Reabrir
      o registro mostra a seleção certa.
- [ ] Trocar de empresa invalida o cache (`queryKey` com `tenant.companyId`)
      e a listagem passa a mostrar os perfis da nova.

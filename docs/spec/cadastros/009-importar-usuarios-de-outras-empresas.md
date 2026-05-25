# Spec: Importar usuários de outras empresas

## Problema

Hoje, vincular um usuário **que já existe na plataforma** a uma nova empresa
exige uma reentrada manual: o operador tem que digitar nome e e-mail
exatamente como estão cadastrados, e o backend (após a mudança recente) **passou
a rejeitar** qualquer cadastro com e-mail duplicado — então o fluxo "novo
usuário" não serve para reaproveitar contas existentes.

A consequência: empresas do mesmo grupo, com pessoas que circulam entre elas
(gerente que atende duas filiais, contador que toca várias empresas, etc.),
não têm um caminho prático para vincular um usuário já existente — a única
saída hoje é uma operação manual no banco.

## Solução proposta

- Nova permissão `users.import` no catálogo, do módulo `users`.
- Botão **"Importar usuário de outra empresa"** dentro do modal de novo
  usuário, visível só para quem tem `users.import` na empresa ativa.
- Ao acionar, abre **modal secundário** com:
  1. Combo/select de **empresa de origem** — lista **todas as empresas
     ativas** da plataforma, exceto a empresa logada. Sem filtro adicional
     por permissão (quem tem `users.import` está autorizado a puxar de
     qualquer empresa).
  2. Lista (com busca) de **usuários daquela empresa** — nome + e-mail.
     ROOT nunca aparece.
  3. Botão "Selecionar".
- Ao selecionar, o modal secundário fecha e o modal principal entra em
  **modo "importação"**:
  - Banner no topo, bem visível, explicando o que está acontecendo
    (`"Importando <Nome> (<e-mail>) da empresa <X>"`) + botão "Cancelar
    importação" para voltar ao modo "criar do zero".
  - Campos **Nome, E-mail e Senha desabilitados** (nome e e-mail
    pré-preenchidos; senha **oculta** — a senha do usuário é única na
    plataforma, importar não deve alterá-la).
  - Campo **Perfil** habilitado — o operador escolhe.
  - Switch **"Usuário ativo"** mantido (default `true`) e seção
    **"Permissões extras"** mantida (collapse padrão), iguais ao fluxo
    de criação.
- Ao salvar: apenas cria o `membership` na empresa ativa. O `User`
  existente não é tocado.
- O usuário importado, depois de salvo, é **indistinguível** dos demais na
  listagem da empresa. Editar ele segue o fluxo normal (modal padrão de
  edição), sem nenhuma trilha especial.

## Comportamento esperado

### Fluxo feliz

1. Operador com `users.create` **e** `users.import` clica "Novo usuário".
2. Modal de criação abre. No topo, acima do formulário, um botão
   **secundário** `"Importar usuário de outra empresa"` (variant outline,
   ícone `UserPlus` ou `Download`).
3. Clica → abre `ImportUserDialog` (modal sobre o modal):
   - Select **Empresa de origem** — popula com **todas** as empresas
     ativas, exceto a empresa logada.
   - Após escolher empresa, dispara `GET /api/users/importable?companyId=X`
     que devolve os usuários daquela empresa que **ainda não têm
     membership ativo na empresa ativa**. Lista com busca server-side por
     nome ou e-mail (debounce padrão). Sem paginação — retorna todos os
     elegíveis de uma vez.
   - Cada linha: nome em destaque, e-mail em muted. Click na linha
     seleciona; botão "Selecionar" no rodapé confirma.
4. Modal secundário fecha. O modal principal agora mostra:
   - **Banner azul/info** no topo:
     `[ℹ] Importando <Nome> da empresa <X>. Nome e e-mail não podem ser
     alterados aqui. [Cancelar importação]`
   - Nome e E-mail preenchidos e desabilitados (fundo `bg-muted/40`,
     cursor not-allowed).
   - Campo Senha **oculto** — a senha do usuário é única na plataforma
     e não pode ser alterada por importação.
   - Campo Perfil: rótulo `"Perfil nesta empresa"`, obrigatório, lista
     os perfis da empresa ativa.
   - "Usuário ativo" (default `true`) + "Permissões extras" (collapse)
     sem mudança.
5. Operador escolhe perfil. Salva.
6. Backend valida e cria o membership. Toast:
   `"Usuário <Nome> importado para esta empresa."`.
7. Modal fecha, listagem atualiza, o usuário aparece com o perfil escolhido.

### Cancelar importação
- Click em "Cancelar importação" volta o modal para o estado inicial
  (criação do zero): limpa nome/e-mail/senha, reabilita os campos,
  remove o banner. **Não fecha o modal**.

### Fluxos alternativos
- **Empresa de origem sem usuários elegíveis**: lista vazia com
  `EmptyState` ("Nenhum usuário disponível para importar desta empresa.").
- **Usuário-alvo virou membership entre a abertura do modal e o salvar**
  (corrida): backend devolve 422 (`"Este usuário já está vinculado a
  esta empresa."`) — toast vermelho, modal continua aberto para o operador
  escolher outro.

### Quais empresas listar (origem)
- Todas as empresas ativas (`is_active = true`, `deleted_at IS NULL`),
  exceto a empresa logada. Sem filtro adicional por permissão na empresa
  de origem — a posse de `users.import` na empresa ativa já é o gate.
- Endpoint: `GET /api/companies/import-sources` (gated por
  `users.import` no tenant ativo). Devolve `{ id, legalName, tradeName }[]`
  ordenado por nome.

### Quais usuários listar (origem)
- Usuários da empresa de origem (`memberships.company_id = X`,
  `deleted_at IS NULL`) que **não têm** membership ativo na empresa
  ativa. ROOT da plataforma é excluído da lista (filtrado por
  `users.is_root = false`).
- Endpoint: `GET /api/users/importable?companyId=X&search=Y`.
- Gate: `users.import` na empresa ativa.

### Permissão `users.import`
- Adicionar ao catálogo com `name: "Importar usuários"`,
  `description: "Reaproveitar usuários já cadastrados em outras empresas."`.
- Sem seed automático — o cliente atribui a perfis sob demanda.

### Edição posterior
- O usuário importado entra na listagem padrão e a edição usa o
  `UserFormDialog` atual, sem nenhuma flag de "importado". O membership é
  o que importa — a origem do usuário não fica registrada em lugar nenhum
  novo.

### Feedback visual (resumo)
- **Banner azul** no modal de criação, em modo importação, com nome/empresa.
- **Botão de importar** com ícone para se diferenciar do submit
  (`UserPlus`/`Download`).
- **Campos desabilitados** com `bg-muted/40` e `cursor-not-allowed`.
- **Campo senha oculto** no modo importação (sem rótulo, sem input).
- **Toast** distinto na importação: "importado para esta empresa", não
  "criado".

## Fora de escopo

- Importar **vários usuários de uma vez** (batch).
- Importar trazendo **as mesmas permissões extras** que ele tem na empresa
  de origem (sempre nasce sem extras na nova empresa).
- Importar e já **aplicar** o role equivalente da origem (sempre escolha
  manual).
- Tela / endpoint para **ver onde mais** um usuário tem acesso (panorama
  cross-empresa do usuário).
- Notificar o usuário por e-mail/sistema que ele ganhou acesso a uma nova
  empresa.
- Auditoria/log de importações (quem importou quem, quando).
- Importar um usuário **soft-deletado** em outra empresa — soft-deletados
  não aparecem na lista.

## Decisões técnicas

### Backend

#### Catálogo
- [catalog.ts](backend/app/abilities/catalog.ts): adicionar
  `{ slug: 'users.import', name: 'Importar usuários', module: 'users',
  action: 'import', description: 'Reaproveitar usuários já cadastrados em
  outras empresas.' }`.

#### Endpoints novos
- `GET /api/companies/import-sources`
  - Middleware: `auth` + `tenant` + `permission('users.import')`.
  - Resposta: `{ id, legalName, tradeName }[]`, ordenada por nome.
  - Lógica: todas as empresas com `is_active = true`,
    `deleted_at IS NULL`, exceto a empresa do tenant ativo. Sem filtro de
    permissão por empresa.
- `GET /api/users/importable?companyId=X&search=Y`
  - Middleware: `auth` + `tenant` + `permission('users.import')` (gate
    na empresa **ativa**).
  - Validações: `companyId` existe, é ativa, e **não é** a empresa do
    tenant — caso seja, 422 ("Não é possível importar da empresa logada.").
  - Filtros: `memberships.company_id = X`, `deleted_at IS NULL`,
    `user.deleted_at IS NULL`, `user.is_root = false`. Exclui usuários
    que já têm membership ativa na empresa do tenant ativo.
  - Sem paginação. Resposta: `{ id, name, email }[]`, ordenada por nome.
- `POST /api/users/import`
  - Middleware: `auth` + `tenant` + `permission('users.import')`.
  - Body: `{ userId, roleId, isActive?, extraPermissions? }`. **Sem
    `password`** — importação não toca na credencial do usuário.
  - Validações:
    - `userId` existe, `is_root = false`, `deleted_at IS NULL`.
    - `userId` tem pelo menos um membership ativo **em outra** empresa
      (defesa em profundidade — o endpoint não é para criar contas).
    - `userId` não tem membership ativa na empresa do tenant.
    - `roleId` pertence à empresa do tenant, ativa, `is_system=false`.
  - Cria o membership em transação. Não altera o `User`.
  - Retorna o `UserDetail` no mesmo formato do `users.show`.

#### `user_service`
- Adicionar método `importExisting(tenant, dto, currentUserId)`.
- Adicionar método `listImportable(tenant, sourceCompanyId, search)`.

### Frontend

#### Permissão
- Sem mudança em `permissions/menu.ts` (não é item de menu).
- Adicionar `users.import` em [module-labels.ts](frontend/src/permissions/module-labels.ts) não é necessário (módulo `users` já está mapeado).

#### Componentes
- Novo: `frontend/src/modules/users/import-user-dialog.tsx`
  - Props: `open`, `onOpenChange`,
    `onSelect: (user: ImportableUser, sourceCompanyName: string) => void`.
  - Internamente carrega:
    - `companiesApi.importSources()` (query)
    - `usersApi.importable(companyId, search)` (query dependente do
      `companyId` selecionado)
  - UI: `Select` ou `Combobox` para empresa + `Input` busca + lista com
    seleção single + `Button` "Selecionar".

- Modificações em `user-form-dialog.tsx`:
  - State novo: `importing: { user: ImportableUser; sourceCompanyName: string } | null`.
  - Quando `importing !== null`:
    - Banner no topo (`Alert` ou `Card` com `variant="info"`/azul).
    - Campos nome/email `disabled` e `readOnly`, valores vindos do
      `importing.user`.
    - Campo senha **não renderiza**.
    - Botão "Cancelar importação" no banner reseta `importing = null` e
      limpa nome/email no form (volta ao modo "criar do zero").
  - Botão `"Importar usuário de outra empresa"` no topo do form, visível
    se `!isEdit && can('users.import')`. Click → abre o
    `ImportUserDialog`.
  - `onSubmit`:
    - Se `importing`: chama `usersApi.import({ userId, roleId,
      isActive, extraPermissions })`.
    - Senão: fluxo atual.

#### API client
- `users-api.ts`: novos métodos `importable(companyId, search)` e
  `import(payload)`.
- `companies-api.ts`: novo `importSources()`.

#### Tipos
- `ImportableUser { id: number; name: string; email: string }`.
- `ImportSourceCompany { id: number; legalName: string; tradeName: string | null }`.
- `ImportUserPayload { userId: number; roleId: number; isActive?: boolean;
  extraPermissions?: number[] }`.

## Critérios de aceite

- [ ] Catálogo passa a ter `users.import`, sem ser atribuída
      automaticamente a nenhum perfil pelo seed.
- [ ] Operador **sem** `users.import` não vê o botão "Importar usuário
      de outra empresa" no modal de novo usuário.
- [ ] Operador **com** `users.import` vê o botão e consegue abrir o
      `ImportUserDialog`.
- [ ] `ImportUserDialog` lista **todas** as empresas ativas exceto a
      empresa logada.
- [ ] Lista de usuários importáveis exclui: ROOT, usuários soft-deletados,
      usuários que já têm membership ativa na empresa do tenant.
- [ ] Selecionar um usuário fecha o modal secundário e ativa o "modo
      importação" no modal principal: banner visível, nome/e-mail
      desabilitados, campo senha oculto, botão "Cancelar importação"
      presente.
- [ ] Cancelar importação volta o modal ao estado de criação do zero,
      sem fechá-lo.
- [ ] Salvar via importação cria o membership e **não altera** o
      `users.password` no banco em hipótese alguma.
- [ ] Backend rejeita import quando o usuário já tem membership ativa
      na empresa do tenant (422).
- [ ] Backend rejeita import quando o `roleId` não é da empresa do tenant
      ou é `is_system=true` (422).
- [ ] Backend rejeita import quando o `userId` é ROOT (422).
- [ ] Backend rejeita import quando o `companyId` de origem é a própria
      empresa do tenant (422).
- [ ] Toast pós-importação diz "importado" (não "criado").
- [ ] Editar o usuário importado depois usa o fluxo padrão sem nenhuma
      diferença visual.

## Contexto técnico

Stack: AdonisJS 6 + PostgreSQL (backend) | React + Vite + TanStack Query +
RHF + Zod + shadcn/ui (frontend). Veja `CLAUDE.md` raiz,
`backend/CLAUDE.md` e `frontend/CLAUDE.md`.

Arquivos a tocar:
- [backend/app/abilities/catalog.ts](backend/app/abilities/catalog.ts) — nova permissão.
- [backend/app/services/user_service.ts](backend/app/services/user_service.ts) — métodos `importExisting` e `listImportable`.
- [backend/app/controllers/users_controller.ts](backend/app/controllers/users_controller.ts) — endpoints novos.
- [backend/app/controllers/me_controller.ts](backend/app/controllers/me_controller.ts) — endpoint `importSourceCompanies`.
- [backend/app/validators/user_validators.ts](backend/app/validators/user_validators.ts) — validator do import.
- [backend/start/routes.ts](backend/start/routes.ts) — rotas novas.
- [frontend/src/modules/users/user-form-dialog.tsx](frontend/src/modules/users/user-form-dialog.tsx) — modo importação.
- [frontend/src/modules/users/import-user-dialog.tsx](frontend/src/modules/users/import-user-dialog.tsx) — novo.
- [frontend/src/services/users-api.ts](frontend/src/services/users-api.ts), `me-api.ts`, [frontend/src/types/api.ts](frontend/src/types/api.ts) — clients e tipos.

---

## Decisões fechadas (referência)

Pontos discutidos e fechados durante a redação da spec:

1. **Senha** — não aparece no modo importação. A senha do usuário é única
   na plataforma e não pode ser alterada por uma importação. O `User.password`
   nunca é tocado pelo endpoint de import.
2. **Empresas de origem** — sem filtro adicional por permissão. Quem tem
   `users.import` no tenant ativo pode importar de qualquer empresa
   ativa, exceto a logada.
3. **ROOT** — nunca aparece na lista de usuários importáveis.
4. **Botão de importar** — fica **dentro** do modal de novo usuário, no
   topo. Não há entrada alternativa pela listagem.
5. **`users.import` sem `users.create`** — a combinação é responsabilidade
   de quem atribui permissões. Sem `users.create` o operador não consegue
   abrir o modal e portanto não usa a importação — não é problema de
   sistema.
6. **Paginação** — sem paginação. Busca server-side por nome/e-mail é
   suficiente; se uma empresa tiver muitos usuários, a busca filtra.
7. **`isActive`** — switch mantido com default `true`.
8. **`extraPermissions`** — collapse padrão mantido, mesmo no modo
   importação. Operador pode definir extras já na importação se quiser;
   ou deixar pra editar depois.

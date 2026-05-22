# Spec: Criar tela de tipo de pagamento

## Problema
Precisamos oferecer para o sistema opções de tipo de pagamento como: "à vista", "boleto", "cartão" e etc.

## Solução proposta
Criar tela de CRUD simples para gerenciar os tipos de pagamento da empresa ativa. Campos visíveis em tela: **descrição** e **status (ativo/inativo)**. O `id` é gerado automaticamente pelo banco.

- A entidade é **por empresa** (multitenant): cada empresa mantém os seus próprios tipos de pagamento. Toda query é filtrada por `tenant.company.id`.
- Gerar as 4 permissões no catálogo: `payment_types.view`, `payment_types.create`, `payment_types.edit`, `payment_types.delete`. ROOT já recebe tudo via curinga `*`. A atribuição para os demais perfis (ADMIN, OPERADOR) será feita depois, quando a tela de montagem de perfil existir.
- Convenção de nomenclatura (regra do projeto): tabela `payment_types`, model `PaymentType`, slugs em inglês.

## Comportamento esperado

### Fluxo feliz
- O usuário com permissão `payment_types.view` acessa a tela pelo menu lateral.
- Vê a listagem paginada (20 por página, server-side) com colunas **Descrição** e **Status**, ordenada por descrição (asc).
- Clica em "Novo tipo" (gated por `payment_types.create`) → abre o formulário em **modal** (regra `crud-form-presentation`: 2 campos → modal).
- Preenche a descrição. O toggle de status já vem ativo por padrão.
- Clica em "Salvar". A validação aplica `trim` e exige pelo menos 1 caractere não-vazio na descrição.
- O registro é salvo, o modal fecha, a listagem atualiza e um toast de sucesso aparece.

### Fluxos alternativos
- **Editar**: clica no botão de editar da linha (gated por `payment_types.edit`) → abre o mesmo modal preenchido. Pode alterar descrição e/ou reativar/desativar.
- **Excluir**: clica no botão de excluir (gated por `payment_types.delete`) → abre `ConfirmDialog` (regra `crud-confirmation-dialogs`). Confirma → **hard delete**. Em caso de violação de FK (registro associado a outra entidade no futuro), o backend traduz o erro do banco para uma mensagem amigável em português (ex.: "Não é possível excluir este tipo de pagamento porque ele está em uso.").
- **Reativar**: editar um tipo inativo e marcar o toggle de status como ativo. Inativos continuam visíveis na listagem justamente para permitir a reativação.

### Regras de negócio
- Multitenant: tipos de pagamento pertencem à empresa ativa. Um usuário nunca vê os tipos de outra empresa (exceto ROOT, que enxerga tudo).
- Descrição: `trim` no submit; mínimo 1 caractere; **não há restrição de unicidade** — descrições duplicadas são permitidas.
- Status: campo `is_active` boolean. Sempre visível na coluna da listagem (badge "Ativa"/"Inativa").
- Sem filtro de status na listagem — inativos e ativos aparecem juntos.
- Ordenação padrão: descrição ascendente. Colunas podem ser ordenáveis (Descrição, Status) seguindo a regra `crud-sortable-columns`.
- Paginação server-side 20/página (regra `crud-pagination`).
- Exclusão é **hard delete** (sem `deleted_at`). Soft delete só quando for explicitamente pedido em outra spec.

## Fora de escopo
- Atribuir as permissões a ADMIN/OPERADOR (vem com a tela de montagem de perfil).
- Filtros (status, busca por descrição) — listagem simples, sem busca por enquanto, salvo se o componente padrão do projeto já oferecer gratuitamente.
- Histórico / auditoria de mudanças.
- Importação em lote.
- Vínculo com módulos consumidores (contas a receber/pagar etc.) — virá em outras specs.

## Decisões técnicas

- **Backend**
  - Migration nova `create_payment_types_table` com colunas: `id`, `company_id` (FK `companies.id`, NOT NULL, índice composto com `description`), `description` (varchar 120, NOT NULL), `is_active` (boolean default true), `created_at`, `updated_at`. **Sem `deleted_at`** (hard delete).
  - Catálogo de permissões (`backend/app/abilities/catalog.ts`): adicionar módulo `payment_types` com as 4 ações.
  - Camadas: `PaymentType` model → `payment_type_repository` → `payment_type_service` → `payment_types_controller` → rota em `start/routes.ts` sob `/api/payment-types` com `middleware.tenant()` e `middleware.permission(...)`.
  - Validator VineJS com mensagens em pt-BR.
  - Seeder principal (`main_seeder.ts`): apenas cadastra as permissões no catálogo. **Sem tipos pré-cadastrados** — cada empresa começa vazia e cadastra os seus.
  - Erro de FK constraint na exclusão futura: tratar no controller/exception handler para retornar 409 com mensagem amigável.

- **Frontend**
  - Rota nova `/payment-types` em `routes/router.tsx`, gated por `payment_types.view`.
  - Item no menu (`permissions/menu.ts`) com ícone `Wallet` (lucide-react) e label "Tipos de pagamento".
  - Página `src/modules/payment-types/payment-types-page.tsx` reusando `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`, `ConfirmDialog`, `Can`, `Skeleton`.
  - Formulário em modal: `src/modules/payment-types/payment-type-form-dialog.tsx` com React Hook Form + Zod, dois campos (Descrição/Input, Status/Switch).
  - API client: `src/services/payment-types-api.ts`.
  - Tipo `PaymentType` em `src/types/api.ts`.
  - QueryKey inclui `tenant.companyId` (regra de cache multitenant).

## Critérios de aceite
- [ ] Migration cria a tabela `payment_types` com `company_id` e índice; sobe e desce limpa.
- [ ] Catálogo de permissões traz `payment_types.view/create/edit/delete`; ROOT acessa por curinga.
- [ ] Endpoints `/api/payment-types` (GET listar, POST criar, GET detalhe, PUT editar, DELETE excluir) com gates de permissão e escopo de tenant.
- [ ] Excluir um tipo associado a outra entidade (em específicos futuros) devolve mensagem em pt-BR via 409.
- [ ] Menu dinâmico mostra o item para quem tem permissão.
- [ ] Listagem paginada 20/página, ordenada por descrição asc, mostra ativos e inativos com badge de status.
- [ ] Incluir registro via modal.
- [ ] Alterar registro via modal (inclui reativar/desativar).
- [ ] Excluir registro via `ConfirmDialog` (hard delete).
- [ ] Validação: descrição não-vazia após `trim`, 1 caractere já é válido.
- [ ] Multitenant: trocar de empresa invalida o cache e mostra somente os tipos da empresa ativa.

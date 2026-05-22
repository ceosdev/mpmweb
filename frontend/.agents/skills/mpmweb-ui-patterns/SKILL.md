---
name: mpmweb-ui-patterns
description: Padrões de UI/UX para as telas de CRUD do MPM Web. Use sempre que for construir ou modificar uma tela de listagem, formulário, dialog ou tabela no frontend. Cobre paginação, ordenação no servidor, apresentação de formulário (rota vs modal), responsividade padrão, reuso de componentes, dialogs de confirmação, campos com máscara (CPF/CNPJ/CEP) e o padrão de CRUD simples (descrição + status, multitenant) que atravessa backend e frontend.
tags: [crud, ui, forms, mpmweb]
---

# MPM Web — Padrões de UI

Convenções específicas de UI/UX para telas, formulários e CRUDs do frontend
do MPM Web. Estas regras complementam (e nunca sobrescrevem) o `CLAUDE.md` do
projeto frontend e a skill `react-vite-best-practices`.

## Quando aplicar

Aplique estas regras quando for:

- Criar uma nova tela de listagem/CRUD em `src/modules/<dominio>/`
- Adicionar, editar ou remover colunas de uma tabela existente
- Desenhar um formulário que cria ou edita um registro
- Implementar uma ação destrutiva ou de múltiplas etapas
- Tratar inputs com máscara (CPF, CNPJ, CEP, telefone etc.)
- Extrair um pedaço de UI que já existe em mais de um lugar

## Índice de regras

| Regra | Assunto |
| --- | --- |
| `crud-pagination` | Paginar toda listagem em 20 registros por página, no servidor. |
| `crud-sortable-columns` | Cabeçalhos clicáveis que ordenam no backend (nunca no cliente). |
| `crud-form-presentation` | Muitos/complexos campos → rota; poucos/simples → modal. |
| `crud-confirmation-dialogs` | Confirme exclusões e qualquer ação com múltiplas escritas no backend. |
| `ui-responsive-desktop-first` | Layout desktop-first, mas sempre utilizável no mobile. |
| `ui-component-reuse` | Prefira extrair um componente compartilhado a duplicar UI. |
| `form-masked-fields` | Armazene o valor cru no banco; renderize com máscara na UI. |
| `simple-crud-pattern` | **Full-stack.** Padrão único para cadastros simples (descrição + status, multitenant, hard delete). |

## Lembrete da stack

Ao aplicar estas regras, use o que já existe no projeto:

- **Estado de listagens e formulários**: TanStack Query (`useQuery` / `useMutation`).
- **Formulários**: React Hook Form + Zod (`zodResolver`).
- **Primitivos de UI**: shadcn/ui em `src/components/ui/`.
- **Blocos compartilhados**: `PageHeader`, `EmptyState`, `ConfirmDialog`, `Can`,
  `FullPageLoader`. Estenda esses componentes em vez de recriá-los.
- **Erros / feedback**: `toast` (sonner) + `getErrorMessage()`.
- **Multiempresa**: toda `queryKey` deve incluir `tenant.companyId`.
- **Permissões**: proteja botões com `<Can>` e rotas com `PermissionRoute`.

## Arquivos de referência

- Listagem de referência (CRUD paginado com formulário em modal): `src/modules/users/users-page.tsx`
- Dialog de formulário de referência: `src/modules/users/user-form-dialog.tsx`
- Dialog de confirmação de referência: `src/components/confirm-dialog.tsx`

# Spec: Ajustar tela de usuários — collapse de permissões extras

## Problema

A seção "Permissões extras" do modal de criação/edição de usuário ocupa muito
espaço vertical mesmo quando o operador não vai mexer nela. Quem abre o modal
só para trocar o perfil ou o status acaba lidando com um *wall* de chips de
permissões que toma quase metade do diálogo.

Por outro lado, ao **editar** um usuário que já tem extras, não há **nenhum
sinal visual** de que existem permissões extras configuradas a menos que o
operador role e leia os chips — se a seção for escondida, isso some também,
e a configuração existente vira invisível.

## Solução proposta

Esconder o conteúdo da seção por trás de um gatilho colapsável, e usar um
**badge com a contagem** para sinalizar quando já existem extras configuradas.

- Modal abre com a seção **colapsada por padrão** em todos os cenários
  (criação e edição, com ou sem extras já configuradas).
- O gatilho é uma linha clicável com o label e um chevron.
- Quando há extras já configuradas, o gatilho mostra um **badge com a
  contagem** à direita do label — é o único sinal visual de presença sem
  precisar expandir.
- Conteúdo expandido é exatamente o mesmo de hoje (chips por módulo).

## Comportamento esperado

### Fluxo feliz — criação
- Operador abre "Novo usuário".
- A seção aparece colapsada com o gatilho: `[+] Adicionar permissões extras`
  (ícone à esquerda, label, chevron à direita).
- Sem badge.
- Clica → seção expande inline, mostrando os chips agrupados por módulo
  (mesmo bloco de hoje).
- Marca alguns chips → badge aparece ao lado do label em tempo real
  (`2 extras`). Clica no gatilho de novo → colapsa, badge continua visível.

### Fluxo feliz — edição com extras pré-existentes
- Operador abre um usuário que já tem 3 extras configuradas.
- Seção colapsada por padrão, gatilho mostra
  `Permissões extras  [3 extras]`.
- Operador pode salvar sem expandir (nada muda).
- Se expandir e desmarcar todos os chips, o badge desaparece em tempo real
  (a contagem vem do `state` local, não do `user` original).

### Fluxo feliz — edição sem extras
- Mesma coisa da criação: gatilho `Adicionar permissões extras`, sem badge.

### Plural/singular
- `1 extra`, `2 extras`, `5 extras`. Zero → sem badge.

### Gating (inalterado)
- A seção (e o gatilho) só aparece para quem tem `permissions.manage` na
  empresa ativa. Quem não tem nem vê o gatilho — mesma regra de hoje.

### Label do gatilho
- Sem extras configuradas: `Adicionar permissões extras`.
- Com extras configuradas: `Permissões extras` + badge.
- O label muda dinamicamente conforme a contagem atravessa zero (se o
  operador desmarca tudo, volta para "Adicionar permissões extras"; se
  marca o primeiro, troca para "Permissões extras" + `1 extra`).

### Acessibilidade
- O gatilho é um `<button type="button">` (não um `<a>` nem `<div>`).
- Atributos: `aria-expanded={isOpen}` e `aria-controls="extra-permissions"`.
- A área expandida recebe `id="extra-permissions"`.

## Fora de escopo

- Multi-empresa na criação de usuário (segue para spec própria).
- Permissões extras diferentes por empresa.
- Mudar a lógica de seleção dos chips (toggle, agrupamento, rótulos).
- Animação de expand/collapse — abertura/fechamento instantâneo é
  suficiente. Se for trivial usar o `Collapsible` do shadcn com a animação
  default, ok; se exigir setup extra, não vale o esforço.
- Componente reutilizável "collapsible com badge" para outras telas — a
  solução vive localmente no `UserFormDialog` e não promove abstração.
- Persistir o estado expandido entre aberturas do modal (sempre abre
  colapsado).

## Decisões técnicas

### Backend
- **Nenhuma mudança.** É exclusivamente um ajuste de UI.

### Frontend
- Arquivo único afetado: [user-form-dialog.tsx](frontend/src/modules/users/user-form-dialog.tsx).
- Novo `useState<boolean>` local: `extrasOpen`, default `false`.
- A condição de exibição da seção (`canManagePermissions`) permanece igual.
- Estrutura do JSX do bloco de extras passa de:
  ```
  {canManagePermissions && <section>...chips...</section>}
  ```
  para:
  ```
  {canManagePermissions && (
    <section>
      <button onClick={toggle} aria-expanded={extrasOpen}>
        <ChevronDown/Up />
        <span>{label}</span>
        {count > 0 && <Badge>{count} {count === 1 ? 'extra' : 'extras'}</Badge>}
      </button>
      {extrasOpen && <div id="extra-permissions">...chips...</div>}
    </section>
  )}
  ```
- `count` vem de `selectedPermissions.length` (state já existente).
- `label` é derivado: `count > 0 ? 'Permissões extras' : 'Adicionar permissões extras'`.
- Ícones: `ChevronDown` (colapsado) / `ChevronUp` (expandido), do
  `lucide-react` (já importado em outros pontos).
- Reusar o `Badge` (`variant="secondary"`) de `components/ui/badge`.
- Quando o `useEffect` reseta o `selectedPermissions` ao abrir o modal
  (linha 91 atual: `setSelectedPermissions(user?.extraPermissions.map((p) => p.id) ?? [])`),
  o `extrasOpen` também volta para `false` no mesmo `useEffect`.

## Critérios de aceite

- [ ] Modal abre com a seção "Permissões extras" colapsada por padrão, tanto
      em criação quanto em edição.
- [ ] Criação: gatilho aparece como `Adicionar permissões extras`, sem badge.
- [ ] Edição sem extras: gatilho idêntico ao da criação.
- [ ] Edição com extras: gatilho aparece como `Permissões extras [N extras]`
      (ou `1 extra` para singular).
- [ ] Clicar no gatilho expande/colapsa a seção; o conteúdo dos chips e o
      comportamento de seleção são exatamente os atuais.
- [ ] Com a seção aberta, marcar/desmarcar chips altera o badge em tempo
      real (aparece ao marcar o primeiro, some ao desmarcar o último).
- [ ] Label do gatilho alterna entre "Adicionar permissões extras" e
      "Permissões extras" conforme a contagem atravessa zero.
- [ ] Reabrir o modal (mesmo após ter expandido na abertura anterior)
      mostra a seção colapsada de novo.
- [ ] Operador sem `permissions.manage` continua sem ver o gatilho nem a
      seção.
- [ ] `aria-expanded` e `aria-controls` corretos no gatilho.

## Contexto técnico

Stack frontend: React + Vite + TanStack Query + RHF + Zod + shadcn/ui.

Arquivo único afetado:
- [frontend/src/modules/users/user-form-dialog.tsx](frontend/src/modules/users/user-form-dialog.tsx) — bloco de "Permissões extras" (linhas ~225–261 do estado atual).

Sem migração, sem mudança de API, sem mudança de tipos.

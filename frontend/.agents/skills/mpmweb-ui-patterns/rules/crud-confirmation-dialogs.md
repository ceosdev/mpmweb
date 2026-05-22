---
title: Confirme exclusões e ações que disparam várias escritas no backend
impact: HIGH
impactDescription: Evita operações destrutivas acidentais
tags: crud, confirm, destructive, ux
---

## Confirme exclusões e ações que disparam várias escritas no backend

**Impacto: HIGH (evita operações destrutivas acidentais)**

Mostre sempre um dialog de confirmação antes de:

- **Qualquer exclusão / remoção / desativação** (hard delete, soft delete,
  arquivar, desativar, revogar acesso).
- **Qualquer ação que dispare mais de uma escrita no backend** mesmo que as
  etapas individualmente não sejam destrutivas — por exemplo: "Aprovar e
  enviar para faturamento", "Converter orçamento em pedido", "Resetar
  senha e desativar usuário".

Por outro lado, **edições inline simples** (alternar `isActive`, renomear,
editar um único campo que mapeia para um único update) **não exigem**
confirmação — seriam fricção sem benefício.

Use o `ConfirmDialog` compartilhado (`src/components/confirm-dialog.tsx`).
Não construa modais de confirmação ad-hoc.

## Errado

```tsx
// ❌ Ruim — ação destrutiva disparada sem confirmação
<Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(user.id)}>
  <Trash2 className="size-4 text-destructive" />
</Button>

// ❌ Ruim — `window.confirm` é abrupto e quebra o design system
if (!window.confirm('Tem certeza?')) return
deleteMutation.mutate(id)
```

## Correto

```tsx
// ✅ Bom — ação destrutiva passa pelo ConfirmDialog
const [deleteId, setDeleteId] = useState<number | null>(null)

const deleteMutation = useMutation({
  mutationFn: (id: number) => usersApi.remove(id),
  onSuccess: () => {
    toast.success('Usuário removido da empresa.')
    queryClient.invalidateQueries({ queryKey: ['users'] })
    setDeleteId(null)
  },
  onError: (error) => toast.error(getErrorMessage(error)),
})

return (
  <>
    {/* gatilho a partir da linha */}
    <Button variant="ghost" size="icon" onClick={() => setDeleteId(user.id)}>
      <Trash2 className="size-4 text-destructive" />
    </Button>

    <ConfirmDialog
      open={deleteId !== null}
      onOpenChange={(open) => !open && setDeleteId(null)}
      title="Remover usuário"
      description="O usuário perderá o acesso a esta empresa. Esta ação pode ser desfeita recriando o vínculo."
      confirmLabel="Remover"
      loading={deleteMutation.isPending}
      onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
    />
  </>
)
```

## Escrevendo bons textos

O texto do dialog é a última chance do usuário voltar atrás. Seja específico:

- **Título** — verbo + objeto em português: *"Remover usuário"*, *"Cancelar
  pedido"*, *"Resetar senha"*. Evite o genérico *"Tem certeza?"*.
- **Descrição** — explique a consequência e a reversibilidade. Diga se o
  dado pode ser recuperado, quem é afetado, o que é disparado em cascata.
- **Label de confirmação** — combine com o verbo da ação. Use
  `variant="destructive"` para operações irreversíveis (é o padrão do
  `ConfirmDialog`; confirme se existe ou estenda o componente).
- **Estado de loading** — desabilite os botões via prop `loading` enquanto
  a mutation estiver pendente; não deixe o usuário clicar duas vezes.

## Quando NÃO confirmar

| Ação | Confirmar? |
| --- | --- |
| Renomear um registro | Não |
| Alternar `isActive` num switch | Não |
| Editar um endereço | Não |
| Salvar um formulário (criar/editar) | Não (o submit já é a intenção explícita) |
| Soft delete a partir da listagem | **Sim** |
| Resetar a senha de outro usuário | **Sim** |
| Ação em lote sobre várias linhas | **Sim** |
| "Aprovar e enviar" (duas escritas no backend) | **Sim** |

## Relacionadas

- [[crud-pagination]] — o menu `…` da linha geralmente abriga a ação
  destrutiva que passa por este dialog.
- [[ui-component-reuse]] — sempre reutilize o `ConfirmDialog`; não crie um
  fork.

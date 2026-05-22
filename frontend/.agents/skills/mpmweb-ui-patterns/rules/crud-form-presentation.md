---
title: Escolha entre modal ou rota de acordo com a complexidade do formulário
impact: HIGH
impactDescription: Formulários ficam adequados à sua carga; sem modais gigantes
tags: crud, forms, modal, route, ux
---

## Escolha entre modal ou rota de acordo com a complexidade do formulário

**Impacto: HIGH (formulários ficam adequados à sua carga; sem modais gigantes)**

Ao desenhar um formulário de criação/edição, escolha a apresentação que
combina com a complexidade dele:

- **Modal (Dialog)** — poucos campos, uma única seção, sem abas, sem listas
  aninhadas. Cabe sem scroll em um notebook típico. Exemplos neste código:
  `UserFormDialog`, `CompanyFormDialog`.
- **Rota (página própria)** — muitos campos, várias seções/abas, listas
  aninhadas ou registros-filho, upload de arquivos, descrições longas. O
  formulário merece sua própria URL para que o usuário possa favoritar,
  recarregar e compartilhar.

Na dúvida, pergunte: *"O usuário precisa de uma edição rápida e contextual
(modal), ou de um espaço de trabalho completo (rota)?"*

## Guia de decisão

| Sinal | Prefira modal | Prefira rota |
| --- | --- | --- |
| Quantidade de campos | ≲ 8 visíveis | Mais de 8 ou agrupados em seções |
| Listas aninhadas (itens, endereços etc.) | Nenhuma | Sim |
| Abas / etapas | Não | Sim |
| Cabe em um notebook sem scroll interno | Sim | Não necessariamente |
| Usuário tende a compartilhar link direto | Não | Sim |
| Ação é "edição rápida" a partir de uma linha | Sim | Menos comum |

## Formulário em modal — padrão de referência

```tsx
// src/modules/users/user-form-dialog.tsx — mantenha o dialog declarativo
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{user ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
    </DialogHeader>

    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      {/* campos */}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

Regras para formulários em modal:

- Largura: `sm:max-w-lg` para casos simples, `sm:max-w-2xl` para algo um
  pouco maior. Nunca em tela cheia — esse é o papel da rota.
- Scroll interno apenas no corpo, nunca no dialog inteiro.
- Resete o formulário (`form.reset(...)`) quando `open` mudar para `true` e
  quando o registro em edição mudar — caso contrário valores antigos vazam
  entre as linhas.
- Fechar o dialog é `onOpenChange(false)`; o caminho de sucesso fecha
  automaticamente dentro do `onSuccess` da mutation.

## Formulário em rota — padrão de referência

```tsx
// src/modules/invoices/invoice-edit-page.tsx
const { id } = useParams()
const isCreating = id === 'new'

const detailQuery = useQuery({
  queryKey: ['invoice', companyId, id],
  queryFn: () => invoicesApi.get(Number(id)),
  enabled: !isCreating,
})

const form = useForm<InvoiceFormValues>({
  resolver: zodResolver(invoiceSchema),
  defaultValues: empty(),
})

useEffect(() => {
  if (detailQuery.data) form.reset(toFormValues(detailQuery.data))
}, [detailQuery.data, form])

return (
  <div className="space-y-6">
    <PageHeader title={isCreating ? 'Nova nota' : 'Editar nota'}>
      <Button variant="outline" asChild>
        <Link to="/invoices">Voltar</Link>
      </Button>
    </PageHeader>

    <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">{/* campos do cabeçalho */}</section>
      <section>{/* tabela de itens */}</section>
      <section>{/* totais + ações */}</section>
    </form>
  </div>
)
```

Regras para formulários em rota:

- Registre a rota em `src/routes/router.tsx` com `lazy()`.
- Coloque-o na mesma pasta do módulo da listagem (`modules/<dominio>/`).
- O botão "Novo" da listagem deve fazer `navigate('/invoices/new')` (ou
  similar) em vez de abrir um dialog.
- Use `useParams` e trate `id === 'new'` como o fluxo de criação.
- Resete o formulário quando a query de detalhe resolver; o formulário
  nunca deve renderizar inputs não controlados que ignoram os dados
  carregados.

## Relacionadas

- [[crud-confirmation-dialogs]] — vale igual para as duas apresentações.
- [[form-masked-fields]] — a máscara funciona igual em modal ou rota.
- [[ui-component-reuse]] — compartilhe os controles de input entre as duas
  apresentações.

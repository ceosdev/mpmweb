# Spec: Criar tela de grupo de despesa

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: grupo de despesa
- Exemplos: ALUGUEL VEICULOS E MOTOS MENSAL, COMBUSTIVEIS E LUBRIFICANTES, CORREIOS E MALOTES
- Justificativa de negócio: cada empresa precisa classificar suas despesas por natureza (aluguel, combustível, correios) para organizar o contas a pagar e apurar custos por grupo em relatórios futuros.

## Específicos do módulo
- Tabela: `expense_groups`
- Slug do módulo: `expense_groups`
- Endpoints: `/api/expense-groups`
- Rota frontend: `/expense-groups`
- Módulo frontend: `src/modules/expense-groups/`
- Ícone (lucide-react): `ReceiptText`
- Label do menu: "Grupos de despesa" (grupo **Cadastros**, em ordem alfabética)

## Critérios de aceite
Padrão da rule simple-crud-pattern.

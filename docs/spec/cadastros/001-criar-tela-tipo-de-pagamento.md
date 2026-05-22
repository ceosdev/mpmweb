# Spec: Criar tela de tipo de pagamento

## Problema
Pecisamos oferecer para o sistema opções de tipo de pagamento como: "a vista", "boleto", "cartão" e etc..

## Solução proposta
Criar tela de crud simples com campos de código(controle interno), descrição e status (ativo/inativo). Ponto importante: Gere as permissões (incluir, alterar e excluir) na tabela adequada, e 
atualize o perfil root com essas permissões.

## Comportamento esperado

### Fluxo feliz
- O usuário acessa a tela de tipo de pagamento disponível no seu perfil.
- Preenche a descrição e por padrão o toggle de status ja esta ativo.
- Clica no botão salvar que valida que o campo não pode ficar vazio.
- O dado é salvo em tabela.

### Fluxos alternativos
- Não aplicável

### Regras de negócio
- É possível manter esse cadastro como um CRUD normal
- Exibir o campo status visivel em tela de listagem

## Fora de escopo
- Não aplicável

## Critérios de aceite
- [ ] Incluir registro.
- [ ] Alterar registro.
- [ ] Excluir registro.
- [ ] Listar registro.
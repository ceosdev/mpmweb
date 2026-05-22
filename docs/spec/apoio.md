# Spec: [Nome da Feature]

## Problema
[O que está errado ou faltando hoje? 2-3 frases. Comportamento atual vs comportamento esperado.]

## Solução proposta
[O que será implementado. Sem detalhes técnicos ainda — foque no comportamento do usuário/sistema.]

## Comportamento esperado
[Descreva os fluxos principais:]
- Fluxo feliz: [o que acontece quando tudo funciona]
- Erro esperado: [o que acontece quando X falha]
- Edge case: [o que acontece quando Y é inválido ou inesperado]

## Fora de escopo
[O que explicitamente NÃO será implementado nesta iteração. Esse campo é tão importante quanto o anterior.]

## Critérios de aceite
- [ ] [Comportamento verificável 1]
- [ ] [Comportamento verificável 2]
- [ ] [Comportamento verificável 3]

## Contexto técnico
[Stack relevante, arquivos afetados, dependências existentes que a implementação precisa respeitar.]


Exemplo preenchido________________________________________________________________________

# Spec: Reset de Senha via Email

## Problema
Usuários que esquecem a senha não conseguem recuperar acesso sem contato com suporte.
Suporte recebe ~20 tickets/semana de reset manual. Comportamento atual: sem mecanismo de
auto-serviço. Comportamento esperado: usuário consegue redefinir senha sem intervenção humana.

## Solução proposta
Fluxo de reset em 2 etapas: (1) usuário solicita email com link, (2) usuário acessa link
e define nova senha. Link expira em 1 hora.

## Comportamento esperado
- Fluxo feliz: usuário informa email → recebe link → clica → define nova senha → login funciona
- Erro esperado: email não cadastrado → mensagem genérica (não revelar se email existe)
- Edge case: link expirado → mensagem clara + botão para solicitar novo link
- Edge case: link já usado → mensagem informando que link é de uso único

## Fora de escopo
- Reset via SMS
- Perguntas de segurança
- Histórico de senhas anteriores

## Critérios de aceite
- [ ] Email chega em até 2 minutos após solicitação
- [ ] Link expira após 1 hora
- [ ] Link não funciona após primeiro uso
- [ ] Página de nova senha valida: mínimo 8 chars, 1 número, 1 letra maiúscula
- [ ] Email inválido não revela se endereço existe na base

## Contexto técnico
Stack: Next.js 14, Prisma, SendGrid. Tabela users no Postgres.
Criar tabela password_reset_tokens (userId, token, expiresAt, usedAt).
Respeitar middleware de rate limiting existente em /api/auth/*.



Validate__________________________________________________________________________________


Revise a spec @nome_da_spec antes de qualquer implementação.

Identifique:
1. Ambiguidades — comportamentos que estão abertos para interpretação
2. Edge cases faltando — situações que a spec não cobre
3. Contradições internas — campos que conflitam entre si
4. Dependências ocultas — algo que parece simples mas exige X que não está especificado

NÃO comece a implementar. Só valide.
Liste os problemas encontrados em ordem de severidade.
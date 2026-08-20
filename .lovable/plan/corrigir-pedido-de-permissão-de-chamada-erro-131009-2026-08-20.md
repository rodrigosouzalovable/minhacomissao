# Corrigir pedido de permissão de chamada (erro 131009)

## O que está acontecendo

O número já tem chamadas ativadas — o problema não é ativação. O log real da Meta é:

```text
(#131009) Parameter value is not valid
details: "CTA review_call_permission not supported."
```

Ou seja: a Meta recusou o **nome da ação** enviado no pedido de permissão. Hoje o sistema envia
`interactive.action.name = "review_call_permission"`, mas a API de chamadas espera o nome
`call_permission_request` no campo `action.name`. Por isso a mensagem "Toque em Aceitar chamada"
nunca chega ao cliente, e sem esse aceite a ligação não pode ser iniciada.

Também aparece "[object Object]" no aviso vermelho porque o detalhe do erro é um objeto e está
sendo colado direto no texto do toast.

## O que vou fazer

1. Corrigir o pedido de permissão para usar o nome de ação aceito pela Meta
   (`call_permission_request`), mantendo o texto da mensagem.
2. Adicionar uma tentativa alternativa automática: se a Meta recusar o nome da ação (131009),
   o sistema tenta o formato antigo antes de desistir, para não quebrar caso a Meta volte atrás.
3. Melhorar a mensagem de erro na tela: mostrar o detalhe legível da Meta (ex.: "CTA ... not
   supported") em vez de "[object Object]", e explicar o próximo passo ao atendente.
4. Testar em um número real (o seu, dentro da janela de 24h) e confirmar pelos logs que a
   mensagem de permissão foi aceita (retorno com `wa_message_id`).

## Detalhes técnicos

- `supabase/functions/meta-call-permission-request/index.ts`: `action.name` passa a ser
  `call_permission_request`; em caso de erro 131009 no CTA, faz um retry com o nome anterior e
  registra os dois retornos no log.
- `supabase/functions/_shared/meta-call.ts`: `humanizarErroChamada` passa a tratar o código 131009
  lendo `error_data.details` e devolvendo texto em português.
- `src/contexts/MetaCallContext.tsx`: `erroLegivel` serializa `details` com segurança
  (string quando string, `JSON.stringify` quando objeto) — sem mudança de fluxo.
- Nenhuma mudança de banco de dados.

## Se ainda falhar depois disso

Se a Meta continuar recusando o CTA nesse número, o caminho suportado é enviar o pedido de
permissão por **template UTILITY** (a função já aceita `template`), e nesse caso eu ligo o botão
de permissão ao template aprovado da instância.

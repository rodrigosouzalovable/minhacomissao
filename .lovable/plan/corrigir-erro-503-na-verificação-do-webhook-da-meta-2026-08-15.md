# Corrigir erro 503 na verificação do webhook da Meta

## O que está acontecendo

O erro da Meta (`HTTP Status Code = 503; Service Unavailable`) não tem relação com a Callback URL nem com o Verify Token — os dois estão corretos. O problema é que a função do webhook **não consegue nem iniciar**.

Os logs da função `meta-whatsapp-webhook` mostram, em todas as tentativas recentes:

```text
worker boot error: Uncaught SyntaxError: Identifier 'norm' has already been declared
    at _shared/iago.ts:484:7
```

Um arquivo compartilhado usado pelo webhook (`supabase/functions/_shared/iago.ts`) declara a mesma função auxiliar `norm` duas vezes (linha 170 e linha 541). Isso é erro de sintaxe: a função morre no boot e responde 503 para a Meta, então a verificação do callback falha.

## Correção

1. Remover a declaração duplicada de `norm` em `_shared/iago.ts`, mantendo uma única versão que atenda aos dois usos (minúsculas + remoção de acentos + `trim`).
2. Conferir se as demais funções que importam esse arquivo (`iago-atendimento`, `iago-followup-tick`, webhook) continuam consistentes com a versão mantida.
3. Verificar se não existem outras duplicações de identificador no arquivo.
4. Após o deploy, confirmar nos logs que a função dá `booted` (sem `BootFailure`) e testar o endpoint de verificação do webhook (`GET` com `hub.challenge`) para garantir resposta 200.

## Depois disso

Você refaz o "Verificar e salvar" no Facebook Developers e reinscreve os eventos; a verificação deve passar sem alterar Callback URL nem Verify Token.

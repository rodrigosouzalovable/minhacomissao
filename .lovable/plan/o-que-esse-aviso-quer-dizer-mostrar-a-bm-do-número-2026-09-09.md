# O que esse aviso quer dizer + mostrar a BM do número

## O motivo (confirmado no banco)

O aviso que você recebeu **não é uma reprovação da Meta**. O registro na fila está como `FALHA_ENVIO` com:

`An unexpected error has occurred. Please retry your request later. [code 2, HTTP 500, trace A3iDcdajwhT351MmsW2m80l]`

Isso é erro **temporário do lado da Meta** (HTTP 500, "tente novamente mais tarde"). O template `autorizado_a_vista_ou_parcelado_ume` nem chegou a ser analisado — a chamada falhou.

O problema é que hoje o sistema trata falha de envio igual a reprovação: soma no contador de "reprovações seguidas" e, no segundo caso, **pausa a fila do número inteiro** sem necessidade. Hoje há 6 itens em `FALHA_ENVIO` na fila.

## Correções

1. **Separar falha temporária de reprovação real**
   - Erros temporários (HTTP 429/500/502/503, `code 2`, `code 4`, rate limit, timeout) passam a ser tratados como *tentar de novo*: o item volta para a fila com nova tentativa (até 3), com espera crescente, e **não** entra na contagem de reprovações nem pausa o número.
   - Só reprovação real da Meta (`REJECTED`) e erros de cadastro (cabeçalho vazio, variável sem exemplo, nome duplicado, token sem permissão) contam para a pausa.

2. **Textos do aviso mais claros**
   - Falha temporária: `⏳ Falha temporária da Meta` + "vou tentar de novo automaticamente", sem falar em pausa.
   - Reprovação real: mantém `⚠️ Template reprovado`, com o motivo já traduzido em português (reaproveitando o tradutor de erros de template que já existe no projeto) e o texto técnico original em seguida.

3. **Mostrar a BM vinculada ao número** em todos esses avisos (falha temporária, reprovação, pausa e conclusão), na linha abaixo do número:

```text
Número: SOUZA 62 8269-8257 (Souza e Ribeiro)
BM: NOME DA BM
Modelo: autorizado_a_vista_ou_parcelado_ume
```

4. **Reativar os números pausados por engano** — os que foram pausados só por falha temporária voltam a andar, e os 6 itens em `FALHA_ENVIO` por erro temporário voltam para a fila.

## Detalhes técnicos

- `supabase/functions/meta-templates-onboarding-tick/index.ts`: nova função `ehErroTemporario(motivo)`; em `FALHA_ENVIO` temporário → `status: 'PENDENTE'`, `tentativas + 1`, `agendado_para` com backoff, sem tocar em `templates_auto_rejeicoes_seguidas`; após 3 tentativas cai em falha definitiva. Mensagens usam `linhaBmInstancia(supabase, inst)` de `_shared/rotulo-instancia.ts` e uma versão server-side de `humanizarErroTemplate`.
- `supabase/functions/_shared/humanizar-erro-template.ts` (novo): mesma lógica de `src/lib/humanizarErroTemplate.ts` para uso nas funções.
- Correção de dados: limpar `templates_auto_status = 'PAUSADO_REJEICOES'` e zerar `templates_auto_rejeicoes_seguidas` das instâncias cuja última falha foi temporária; reenfileirar os itens `FALHA_ENVIO` com erro `code 2 / HTTP 500`.
- Sem novo cron, sem novo polling — o tick já existente continua sendo o único motor. Impacto de custo: nulo.

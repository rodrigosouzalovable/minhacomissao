# Corrigir o teste do Webhook VirtualSMS (HTTP 401)

## O que está acontecendo

O 401 vem do nosso lado, de propósito: a função `virtualsms-webhook` só aceita o evento se ele vier
autenticado de uma das duas formas:

1. cabeçalho `X-Webhook-Signature` com HMAC-SHA256 **em hexadecimal** do corpo exato, ou
2. `?token=<segredo>` na URL.

A URL que você colou no site não tem `?token=`, então sobra a assinatura. O botão "Test" do provedor
ou não envia assinatura, ou a envia em um formato diferente do que esperamos (por exemplo base64,
com prefixo, ou assinando corpo + timestamp). Não há como saber qual é sem ver a requisição real —
e hoje a função descarta a requisição rejeitada sem registrar nada.

## O que vou mudar

1. **URL com token pronta no painel** — a caixa "Webhook URL" passa a mostrar a URL já com
   `?token=<segredo>`, com botão de copiar. Isso resolve o teste na hora, sem depender do formato da
   assinatura do provedor.
2. **Aceitar mais formatos de assinatura** — comparar o HMAC em hex e em base64, com e sem prefixo
   (`sha256=`), e também aceitar o segredo enviado puro em cabeçalhos comuns
   (`X-Webhook-Secret`, `Authorization: Bearer`).
3. **Registrar as tentativas rejeitadas** — quando um evento for recusado, gravar cabeçalhos
   (sem o valor do segredo) e um trecho do corpo, para eu identificar o formato exato que a
   VirtualSMS usa e, se for o caso, ajustar a validação com precisão.
4. **Diagnóstico no painel** — mostrar em "Webhook" a data da última tentativa recusada e o motivo,
   para diferenciar "o provedor nunca chamou" de "chamou e foi recusado".
5. **Aceitar payload de teste** — o "Test" do provedor normalmente manda dados fictícios; a função
   vai responder 200 e marcar o webhook como ativo, mesmo sem encontrar pedido correspondente
   (hoje isso já acontece, mas fica registrado como teste).

## Detalhes técnicos

- `supabase/functions/virtualsms-webhook/index.ts`: validação de assinatura multi-formato,
  aceitação de token via querystring ou cabeçalho, log estruturado da tentativa recusada.
- `virtualsms_config`: colunas novas `ultima_rejeicao_em`, `ultima_rejeicao_motivo`,
  `ultima_rejeicao_debug` (texto curto, sem segredos).
- `supabase/functions/virtualsms/index.ts` (`webhook_info`): retornar a URL com token e os dados de
  rejeição.
- `src/components/acionamento/NumerosVirtuaisPanel.tsx`: exibir a URL com token, o status de
  rejeição e instruções curtas.

Nenhum custo recorrente novo: não há cron nem polling adicional.

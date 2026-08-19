# Webhook da VirtualSMS (SMS em tempo real)

Não é obrigatório — hoje o painel já busca o código repetindo consultas ao provedor a cada 5s enquanto a aba está aberta. Mas o webhook é melhor e mais barato: o código chega na hora, mesmo com a aba fechada, e derrubamos a consulta repetida.

## O que muda na tela

- No painel "Números Virtuais" (aba UAZAPI), um bloco novo "Webhook" mostrando a URL que você deve colar no site da VirtualSMS, com botão de copiar, e o status "Ativo / Nunca recebeu evento" com a data do último evento recebido.
- Quando o SMS chegar, o código aparece sozinho no card do pedido, sem precisar deixar a aba aberta.
- A consulta automática a cada 5s cai para uma verificação a cada 20s apenas como rede de segurança, e para de vez assim que o webhook receber o primeiro evento.

## Como você configura (uma vez)

1. Copiar a URL do webhook no painel.
2. No site da VirtualSMS, em Dashboard → Webhook Configuration: colar a URL, marcar "SMS Received" e também "Status Changed", e salvar.
3. Colar no campo "Secret Key" do site a mesma chave secreta que o painel vai exibir (gerada e guardada no backend), para que só eventos legítimos sejam aceitos.

## Detalhes técnicos

- Nova edge function pública `virtualsms-webhook` (`verify_jwt = false`) que recebe o POST do provedor:
  - valida a assinatura do header `X-Webhook-Signature` (HMAC do corpo cru com o secret) e responde 401 se não conferir; aceita também `?token=` na URL como reforço.
  - identifica o pedido pelo `order_id` (ou pelo número, tolerando nomes variados de campo como já faz a função atual) e grava `codigo`, `texto_sms`, `status = recebido` / `expirado` / `cancelado`, `recebido_em`.
  - idempotente: se o pedido já tem código, não sobrescreve; sempre responde HTTP 200 para o provedor não reenviar em loop.
  - grava `ultimo_evento_em` em `virtualsms_config` para o indicador de status.
- Secrets: `VIRTUALSMS_WEBHOOK_SECRET` gerado no backend (nunca no código).
- Migração: colunas `texto_sms`, `recebido_em` em `virtualsms_pedidos` (se ainda não existirem) e `ultimo_evento_em` em `virtualsms_config`.
- `virtualsms/index.ts`: nova ação `webhook_info` (admin-only) devolvendo URL, secret e `ultimo_evento_em`.
- `NumerosVirtuaisPanel.tsx`: bloco do webhook + ajuste do intervalo de verificação (20s, com guard de visibilidade, desligado após o primeiro evento).

## Custo

Reduz custo: menos chamadas de função e menos requisições ao provedor do que o polling atual. Sem cron novo e sem tabela nova.

# Confirmação automática no WhatsApp para acordos fechados pelo portal

## O que muda
Sempre que o cliente fechar um acordo pelo portal, ele recebe no WhatsApp dele (o telefone informado no portal) uma mensagem de confirmação com:
- nome, credor (UME ou Odres Cred), quantidade e valor das parcelas, total e 1º vencimento;
- o código PIX copia-e-cola e o link do boleto da 1ª parcela (quando emitidos);
- para Odres: aviso de desbloqueio do telefone em até 2 horas após o PIX.

A mensagem aparece no Inbox, na conversa do cliente, e o seu aviso de admin passa a dizer se a confirmação foi entregue ou falhou.

## Como escolhe por onde enviar
1. Se o cliente já tem conversa no Inbox Meta com janela de 24h aberta (normal quando veio de uma campanha e respondeu), envia texto livre pelo mesmo número da conversa — sem custo.
2. Se a janela estiver fechada ou não houver conversa, envia um template Utility aprovado de confirmação de acordo (ex.: "Olá {{1}}! Seu acordo com a {{2}} foi registrado: {{3}}, 1º vencimento {{4}}. Responda esta mensagem para receber o código PIX."), pelo número com quem ele conversou ou, se não houver, pelo rodízio de números GREEN da caixa PADRÃO. Quando ele responder, o PIX é enviado (janela aberta).
3. Se nada estiver disponível (nenhum template aprovado/número apto), não bloqueia o acordo: registra a falha e o aviso de admin pede envio manual.

Nunca envia duas vezes para o mesmo acordo (chave por acordo).

## Ponto de atenção
O template de confirmação precisa ser criado e aprovado pela Meta (até 48h). Até a aprovação, só os clientes com janela aberta recebem automaticamente; os demais caem no aviso de envio manual.

## Detalhes técnicos
- `portal-efetivar-acordo`: após lançar o acordo, chamar novo helper `_shared/portal-confirmacao-cliente.ts`, envolto em try/catch (falha nunca afeta a resposta do portal).
- Helper: localizar conversa Meta pelo sufixo de 8 dígitos; checar janela 24h (`metaJanelaEnvio.ts`); enviar via `send-whatsapp-meta-handler.ts` gravando no Inbox; senão template Utility via escolha de instância existente (`pick-meta-instance-handler.ts`).
- Idempotência via `whatsapp_envios_log` (tipo `portal_confirmacao`, chave = acordo_id).
- Incluir status do envio na mensagem de `notificarAdmin`.
- Criar o template Utility pela rotina existente de templates.
- Sem novo cron, polling ou loop: um envio por acordo fechado, custo desprezível.

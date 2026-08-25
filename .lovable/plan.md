# Salvar o JID real da UAZAPI no contato e reutilizar no envio

## Situação atual confirmada

- O webhook UAZAPI (`whatsapp-chatbot`) já recebe o identificador real do chat (`chatid` / `wa_chatid` / `sender_pn` / `key.remoteJid`), mas usa esse valor apenas para extrair dígitos.
- O espelhamento no Inbox (`_shared/espelho-inbox-meta.ts`) grava somente o telefone normalizado em `meta_whatsapp_contatos`, e a tabela hoje não tem nenhuma coluna para guardar o JID original.
- No envio (`send-whatsapp-meta-text`), o destino é reconstruído a partir do telefone salvo, testando variações (com e sem o 9º dígito). Quando o JID real é diferente dessas variações, a UAZAPI recusa o destino.

Resultado: perdemos o identificador que a própria UAZAPI usou para entregar a mensagem, e as respostas passam a depender de adivinhação de formato.

## O que será feito

1. **Guardar o JID real do chat**
   - Nova coluna no cadastro de contatos do Inbox para armazenar o identificador original recebido da UAZAPI.
   - O valor é gravado/atualizado a cada mensagem recebida desses números, sem alterar o telefone exibido na conversa.

2. **Usar o JID salvo como primeiro destino no envio**
   - Ao responder uma conversa de número não oficial, o sistema tenta primeiro exatamente o identificador que a UAZAPI entregou.
   - Somente se ele falhar é que as variações atuais do telefone continuam sendo testadas, mantendo o comportamento de reserva já existente.

3. **Preservar o que já funciona**
   - O telefone continua sendo exibido e usado normalmente na interface e nas buscas por sufixo de 8 dígitos.
   - O tratamento de "destinatário sem WhatsApp" permanece, apenas passa a ser acionado depois de tentar o identificador correto.

4. **Validar**
   - Enviar uma resposta de teste em uma conversa da caixa AQUECIMENTO e conferir se o envio sai pelo identificador salvo.
   - Conferir no banco se o campo está sendo preenchido nas novas mensagens recebidas.

## Detalhes técnicos

- Migration: adicionar `wa_jid text` (nullable) em `meta_whatsapp_contatos`, sem alterar RLS/grants existentes.
- `whatsapp-chatbot`: repassar o `remoteJid` bruto para o espelhamento.
- `_shared/espelho-inbox-meta.ts`: aceitar `waJid` em `EspelhoMensagem` e gravar/atualizar `wa_jid` no contato (apenas quando vier valor de chat individual, ignorando grupo/status).
- `send-whatsapp-meta-text`: ler `wa_jid` do contato e passá-lo como primeiro item de `montarDestinosUazapi`, mantendo as variações atuais como fallback.
- Também repassar o JID salvo no fluxo de mídia (`send-whatsapp-meta-media`) se ele usar a mesma montagem de destino.
- Sem cron, polling, canal em tempo real ou consulta recorrente nova: custo praticamente zero (uma coluna e uma leitura já feita no envio).

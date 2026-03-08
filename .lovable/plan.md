## ✅ Concluído — Notificar admin quando a IA não entender o cliente

Implementado em `supabase/functions/whatsapp-chatbot/index.ts`:

1. **`notificarAdmin()`** — envia WhatsApp para 5562991672674 com detalhes do que o cliente falou
2. **`salvarSilenciosoENotificar()`** — salva estado como `aguardando_humano` sem responder ao cliente
3. **4 pontos de fallback substituídos**: `proposta_enviada`, `oferta_valores`, `aguardando_pagamento_hoje`, `aguardando_data`
4. **Etapa `aguardando_humano`** — ignora mensagens do cliente, re-notifica admin se insistir
5. **Desbloqueio via `fromMe`** — quando admin envia mensagem para o cliente, conversa volta à etapa anterior

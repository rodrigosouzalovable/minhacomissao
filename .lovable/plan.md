## ✅ Concluído — Resposta do Admin via WhatsApp

Implementado em `supabase/functions/whatsapp-chatbot/index.ts`:

1. **`parseAdminInstruction()`** — detecta se texto está entre aspas (literal) ou é instrução livre (IA gera resposta)
2. **`gerarRespostaComInstrucaoAdmin()`** — usa Gemini Flash Lite para formular resposta natural baseada na instrução + contexto
3. **Registro `admin_pending_{instanceToken}`** — salvo em `chatbot_conversas` quando `salvarSilenciosoENotificar` é chamado, mapeia qual cliente aguarda resposta
4. **Interceptação de mensagens do admin** — quando `telefone === ADMIN_NUMERO`, busca cliente pendente, envia resposta (literal ou IA), desbloqueia conversa
5. **Confirmação ao admin** — envia `✅ Mensagem enviada para {telefone}` após envio
6. **Cleanup** — remove registro `admin_pending` após processamento

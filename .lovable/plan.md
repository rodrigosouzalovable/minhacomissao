

## Plano: Central de WhatsApp (Inbox Unificado) — V1 ✅ IMPLEMENTADO

### O que foi feito:

1. **Tabelas criadas**: `whatsapp_mensagens` e `whatsapp_contatos` com RLS, índices e Realtime habilitado
2. **whatsapp-chatbot** modificado para salvar todas as mensagens (entrada e saída) automaticamente
3. **send-whatsapp** modificado para salvar mensagens enviadas pelo Inbox (quando `instancia_id` é passado)
4. **Página `/inbox`** criada com layout estilo WhatsApp Web (dois painéis, balões de mensagem, realtime)
5. **Rota e navegação** adicionadas (admin only)

### Próximos passos (V2):
- Suporte a mídia (imagens, áudio)
- Scroll infinito / paginação
- Envio de áudios pelo inbox

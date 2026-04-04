
## Exibir Áudios e Imagens no WhatsApp Inbox

### Problema
O webhook (`whatsapp-chatbot`) só extrai texto das mensagens recebidas. Mensagens de áudio e imagem da UAZAPI são ignoradas porque:
1. O texto é extraído apenas de campos de texto (linha 617)
2. A condição `if (inboxTelefone && inboxTexto)` pula mensagens sem texto (áudios/imagens)
3. Os inserts não incluem `tipo_conteudo` nem `media_url`

O componente `ChatMessage.tsx` já renderiza áudio, imagem e documento corretamente — o problema é apenas no backend.

### Alterações

**Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`**

1. Após extrair `inboxTexto` (linha 617), adicionar detecção de mídia do payload UAZAPI:
   - Detectar áudio: `payload?.message?.audioMessage` ou `payload?.message?.type === 'audio'`
   - Detectar imagem: `payload?.message?.imageMessage` ou `payload?.message?.type === 'image'`
   - Detectar documento: `payload?.message?.documentMessage` ou `payload?.message?.type === 'document'`
   - Extrair URL da mídia: `payload?.message?.media_url` ou `payload?.message?.audioMessage?.url` ou `payload?.message?.imageMessage?.url` etc.

2. Definir variáveis `inboxTipoConteudo` (texto/audio/imagem/documento) e `inboxMediaUrl`

3. Alterar a condição da linha 622 de `if (inboxTelefone && inboxTexto)` para `if (inboxTelefone && (inboxTexto || inboxMediaUrl))` — para não pular mensagens de mídia

4. Nos dois inserts de `whatsapp_mensagens` (linhas 659 e 696), adicionar:
   - `tipo_conteudo: inboxTipoConteudo`
   - `media_url: inboxMediaUrl || null`

5. Para o `conteudo` quando for mídia sem texto: usar fallback como "🎤 Áudio", "📷 Imagem" ou "📄 Documento"

6. Fazer download do arquivo de mídia (se a URL for temporária da UAZAPI) e salvar no bucket `inbox-media` para ter uma URL permanente, seguindo o mesmo padrão já usado no `send-whatsapp-media`

### Detalhes técnicos

- O payload da UAZAPI para mídia tipicamente contém: `message.type` (audio/image/document), `message.media_url` ou URLs dentro de `message.audioMessage.url`, `message.imageMessage.url`
- O bucket `inbox-media` já existe com acesso público
- A política de retenção de 3 dias do `cleanup-inbox-media` já cobre esses arquivos automaticamente
- O `ChatMessage.tsx` já renderiza `<audio>`, `<img>` e links de documento baseado no `tipo_conteudo` — nenhuma alteração no frontend é necessária

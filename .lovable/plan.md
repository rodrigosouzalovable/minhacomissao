

## Envio de Áudio, PDF e Imagem no WhatsApp Inbox

### Resumo
Adicionar no chat do Inbox: (1) gravação de áudio com microfone, (2) envio de PDF e imagem via file picker. Arquivos de mídia ficam no storage por 3 dias e depois são substituídos por um placeholder textual.

### Alterações no banco de dados (migration)

1. **Adicionar coluna `tipo_conteudo` na tabela `whatsapp_mensagens`**:
   - `tipo_conteudo TEXT DEFAULT 'texto'` — valores: `texto`, `audio`, `imagem`, `documento`
   
2. **Adicionar coluna `media_url` na tabela `whatsapp_mensagens`**:
   - `media_url TEXT DEFAULT NULL` — URL do arquivo no storage

3. **Criar bucket `inbox-media`** (público, para que a UAZAPI consiga acessar as URLs):
   - RLS: upload para autenticados, leitura pública

4. **Criar função agendada (pg_cron) ou edge function para limpeza**:
   - Uma edge function `cleanup-inbox-media` que roda diariamente, busca mensagens com `media_url` não nulo e `criado_em < now() - 3 days`, deleta o arquivo do storage, e atualiza o `conteudo` para "Acesse seu WhatsApp para ver este arquivo" e `media_url` para null.

### Nova Edge Function: `send-whatsapp-media`

Função unificada para enviar imagens/documentos via UAZAPI:
- Recebe: `telefone`, `media_url`, `type` (image/document), credenciais UAZAPI, `instancia_id`
- Usa endpoint `/send/media` com `{ number, type, file: media_url }`
- Salva mensagem no inbox com `tipo_conteudo` e `media_url`

### Nova Edge Function: `cleanup-inbox-media`

- Busca mensagens com `media_url IS NOT NULL` e `criado_em < now() - interval '3 days'`
- Deleta arquivos do bucket `inbox-media`
- Atualiza `conteudo` → "Acesse seu WhatsApp para ver este arquivo", `media_url` → null

### Alterações no Frontend: `src/pages/WhatsAppInbox.tsx`

1. **Botão de gravar áudio** (ícone microfone):
   - Usa `MediaRecorder` API do navegador
   - Ao parar gravação: faz upload do blob para `inbox-media/{instancia_id}/{telefone}/{timestamp}.ogg`
   - Chama `send-whatsapp-audio` com a URL pública do storage
   - Mostra indicador visual "Gravando..." com timer e botão de cancelar/enviar

2. **Botão de anexar arquivo** (ícone clip/paperclip):
   - File picker aceita `image/*,.pdf`
   - Upload para `inbox-media/{instancia_id}/{telefone}/{timestamp}.{ext}`
   - Chama `send-whatsapp-media` com tipo adequado (image ou document)

3. **Renderização de mensagens com mídia**:
   - Se `tipo_conteudo === 'audio'` → player de áudio inline
   - Se `tipo_conteudo === 'imagem'` e `media_url` existe → thumbnail da imagem
   - Se `tipo_conteudo === 'documento'` e `media_url` existe → ícone PDF com link
   - Se `media_url` é null e tipo não é texto → mostra "Acesse seu WhatsApp para ver este arquivo"

4. **Área de input** — reorganizar:
   - `[📎 Anexo] [Input texto] [🎤 Microfone / ➤ Enviar]`
   - Quando há texto digitado, mostra botão Enviar; quando vazio, mostra Microfone

### Alteração na Edge Function existente: `send-whatsapp-audio`

- Adicionar parâmetros `tipo_conteudo: 'audio'` e `media_url` ao insert na tabela `whatsapp_mensagens`

### Detalhes técnicos

- **Gravação de áudio**: `MediaRecorder` com `mimeType: 'audio/webm;codecs=opus'` (fallback para `audio/ogg`)
- **Storage path**: `inbox-media/{instancia_id}/{telefone}/{uuid}.{ext}`
- **Limpeza**: Edge function invocada via pg_cron ou chamada manual/scheduled — deleta do storage e atualiza DB
- **UAZAPI**: Endpoint `/send/media` com `type: 'image'` para imagens, `type: 'document'` para PDFs, `type: 'ptt'` para áudio


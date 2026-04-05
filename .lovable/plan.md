

## Corrigir reprodução de áudio e exibição de imagens no WhatsApp Inbox

### Problema raiz
Os arquivos de mídia (áudio, imagens, documentos) estão sendo salvos no storage com o MIME type errado: `application/octet-stream`. Isso acontece porque ao baixar o arquivo da UAZAPI, o `blob.type` vem vazio, e o código faz fallback para `application/octet-stream`. O navegador não consegue reproduzir áudio nem exibir imagens quando o Content-Type está errado.

### Solução (2 partes)

**1. Corrigir o upload no webhook (para novos arquivos)**

No `supabase/functions/whatsapp-chatbot/index.ts`, na linha ~697 do upload, usar o MIME type correto baseado no `uazapiMimetype` ou no tipo detectado, em vez de confiar no `blob.type`:

```typescript
// Antes:
.upload(storagePath, blob, { contentType: blob.type || 'application/octet-stream' })

// Depois:
const correctMimeType = uazapiMimetype || blob.type || 
  (inboxTipoConteudo === 'audio' ? 'audio/ogg' : 
   inboxTipoConteudo === 'imagem' ? 'image/jpeg' : 
   inboxTipoConteudo === 'documento' ? 'application/pdf' : 
   'application/octet-stream');
.upload(storagePath, blob, { contentType: correctMimeType })
```

**2. Corrigir o componente ChatMessage (para arquivos já existentes)**

No `src/components/inbox/ChatMessage.tsx`, adicionar `type` na tag `<source>` do áudio para forçar o MIME type correto baseado na extensão da URL. Para imagens, o problema também se resolve no lado do servidor, mas podemos adicionar um handler de erro para mostrar um fallback.

- Audio: inferir o tipo MIME da extensão da URL (.ogg -> audio/ogg, .mp3 -> audio/mpeg)
- Imagem: adicionar `onError` handler para exibir placeholder

**3. Migração dos arquivos existentes (opcional mas recomendado)**

Atualizar o MIME type dos arquivos já salvos no bucket via uma query SQL de update nos metadados do storage.

### Arquivos a alterar
- `supabase/functions/whatsapp-chatbot/index.ts` - corrigir contentType no upload
- `src/components/inbox/ChatMessage.tsx` - adicionar type no source e fallback de imagem


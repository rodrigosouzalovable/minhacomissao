## Problema

No Inbox Meta, mídias recebidas (imagem, áudio, PDF, vídeo) aparecem como "Mídia indisponível". A Meta Cloud API não envia a URL da mídia direto no webhook — envia só o `media_id`, e é preciso baixar em 2 passos autenticados com o `access_token` da instância, o que hoje o webhook não faz.

## Solução

Baixar a mídia no momento em que o webhook chega, salvar no bucket público de storage e gravar a URL pública em `meta_whatsapp_mensagens.media_url`. A partir daí o `InboxMeta.tsx` já sabe renderizar imagem/áudio/vídeo/PDF (mesma lógica do WhatsApp Inbox).

## Passos

### 1. `supabase/functions/meta-whatsapp-webhook/index.ts`
- Para cada `message` recebida (não echo) com `type ∈ {image, audio, video, document, sticker}`:
  1. Ler `m[type].id` (media_id) e `m[type].mime_type`.
  2. `GET https://graph.facebook.com/v21.0/{media_id}` com `Authorization: Bearer {inst.access_token}` → obtém `url`.
  3. `GET url` com o mesmo Bearer → binário.
  4. Upload em bucket público `meta-whatsapp-media` no path `{instancia_id}/{wa_message_id}.{ext}` (extensão derivada do mime).
  5. Pegar `publicUrl` e gravar em `media_url` do insert.
- Para documento, preservar `document.filename` no campo `conteudo`.
- Se o download falhar (token expirado, mídia > 24h expirada na Meta): logar e seguir sem `media_url` (fallback atual "Mídia indisponível").
- Echoes (`smb_message_echoes`) recebem o mesmo tratamento — a Meta também expõe `media_id` neles.

### 2. Storage
- Criar bucket `meta-whatsapp-media` público (SELECT anon) via migration, se ainda não existir. Alinhado à regra do projeto de manter SELECT público para funcionar tanto no app quanto em previews externos.

### 3. UI (`src/pages/InboxMeta.tsx`)
Nenhuma mudança necessária — a renderização de `media_url` por `tipo_conteudo` já existe. Só passa a receber URLs válidas.

## Escopo / não-escopo

- Só afeta mensagens **novas** que chegam após o deploy. Mensagens antigas continuam como "Mídia indisponível" (a Meta descarta a mídia após alguns dias, não dá pra buscar retroativo).
- Sem mudança em envio de mídia (já funciona via `send-whatsapp-meta-media`).
- Sem mudança de custo relevante: storage é o mesmo que já usamos no WhatsApp Inbox.
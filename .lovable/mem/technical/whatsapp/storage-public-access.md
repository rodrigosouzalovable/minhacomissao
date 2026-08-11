---
name: Storage de mídia do WhatsApp
description: Bucket inbox-media é PRIVADO; acesso via URLs assinadas de 1 ano (Meta/UAZAPI baixam por essa URL)
type: constraint
---

O bucket `inbox-media` é **privado** (correção de segurança: mídias de devedores não podem ficar públicas).

Regras:
- Nunca voltar o bucket para público nem recriar policy de SELECT para `public`/`anon`. SELECT apenas para `authenticated` (policy "Auth read inbox-media").
- Todo upload deve gerar **URL assinada** (validade 1 ano):
  - Frontend: usar `src/lib/inboxMediaUrl.ts` (`uploadInboxMedia`, `signedInboxMediaUrl`, `ensureInboxMediaUrl`).
  - Edge functions: `storage.createSignedUrl(path, 60*60*24*365)`.
- A URL assinada é o que se envia para Meta/UAZAPI baixarem a mídia (funciona como link HTTPS normal).
- `ChatMessage.tsx` reassina URLs antigas/públicas antes de exibir via `ensureInboxMediaUrl`.
- `cleanup-inbox-media` extrai o caminho de URLs `/object/public/` **e** `/object/sign/`.

Outros buckets de aquecimento/áudio que a UAZAPI baixa continuam com suas regras próprias.

## Problema

O erro `new row violates row-level security policy` acontece ao enviar arquivo no Inbox Meta porque a policy de INSERT do bucket `inbox-media` exige que o usuário autenticado seja o `user_id` dono da instância Meta (`meta_whatsapp_instances`):

```
EXISTS (SELECT 1 FROM meta_whatsapp_instances mi
        WHERE mi.id::text = folder[1] AND mi.user_id = auth.uid())
```

O usuário que está enviando (atendente Wallace) não é o dono cadastrado da instância LD 12 — mesmo tendo acesso via equipe/compartilhamento. Por isso mensagens de texto funcionam (vão por edge function com service role, ignorando RLS), mas o upload de arquivo/imagem/áudio é client-side e bate na RLS do Storage.

Também há um bug secundário: o `useMetaAudioRecorder` faz upload em `meta/{id}/...` — o `folder[1]` vira `'meta'`, o que hoje só passa por acaso quando o usuário é admin/dono; para os demais o áudio também estaria falhando com o mesmo erro.

## Correção (apenas backend/RLS, sem mudança de UI)

Migration ajustando as policies do bucket `inbox-media` em `storage.objects` para permitir que **qualquer usuário autenticado** faça upload/update/delete quando:

- `folder[1]` corresponde a uma linha existente em `meta_whatsapp_instances` (sem exigir `user_id = auth.uid()`) — o envio para a Meta é validado depois pela edge function `send-whatsapp-meta-media`; **ou**
- `folder[1]` corresponde a uma linha em `user_whatsapp_instances` do próprio usuário (mantém regra atual); **ou**
- `folder[1]` é `meta-templates`, `quick-replies` ou `meta` (path usado pelo gravador de áudio).

Admins continuam permitidos como fallback. SELECT público permanece igual (necessário para UAZAPI/Meta baixar a mídia).

Passos:

1. Substituir as policies `Auth upload inbox-media`, `Auth update inbox-media` e `Auth delete inbox-media` por versões que removem o filtro `mi.user_id = auth.uid()` para instâncias Meta e passam a aceitar também o prefixo `meta/`.
2. Não alterar UI, hooks ou edge functions.

## Verificação

- Reproduzir upload de PDF numa conversa cujo `instancia_id` não pertence ao `auth.uid()` do usuário logado e confirmar que o dialog não retorna mais o erro de RLS.
- Rodar `supabase--linter` para confirmar que não há regressão de segurança.
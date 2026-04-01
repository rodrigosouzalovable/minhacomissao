

## Make System-Sent Messages Appear in WhatsApp Inbox

### Problem
When messages (text or audio) are sent by the system (campaigns, reminders, auto-send, queue processing), they don't appear in the WhatsApp Inbox because:
1. **`send-whatsapp-audio`** doesn't save anything to `whatsapp_mensagens`/`whatsapp_contatos`
2. **`send-whatsapp`** only saves to inbox when `instancia_id` is passed — most callers don't pass it
3. **`process-whatsapp-queue`** sends via UAZAPI directly without saving to inbox

### Solution
Save outgoing messages to the inbox tables in the edge functions by looking up the `instancia_id` from `user_whatsapp_instances` using the `server_url` + `instance_token` credentials.

### Changes

**1. `supabase/functions/send-whatsapp/index.ts`**
- When `instancia_id` is NOT provided but `uazapi_server_url` + `uazapi_instance_token` ARE provided, look up the matching `instancia_id` from `user_whatsapp_instances` table
- This makes all callers (reminders, auto-send, acionamento, etc.) automatically save to inbox without changing any frontend code

**2. `supabase/functions/send-whatsapp-audio/index.ts`**
- Add Supabase client import
- Accept optional `instancia_id` in the request body
- If not provided, look up `instancia_id` from `user_whatsapp_instances` using `server_url` + `instance_token`
- After successful send, insert a record into `whatsapp_mensagens` with `conteudo: '🎵 Áudio enviado'` (or similar descriptive text)
- Upsert the `whatsapp_contatos` entry (same pattern as `send-whatsapp`)

**3. `supabase/functions/process-whatsapp-queue/index.ts`**
- After successful send, look up `instancia_id` from credentials and save the message to `whatsapp_mensagens` + upsert `whatsapp_contatos`

**4. `src/contexts/VoiceCampaignSendingContext.tsx`**
- Pass `instancia_id: instance.id` in the body when invoking `send-whatsapp-audio` (the instance object already has `.id`)

**5. `src/contexts/WhatsAppSendingContext.tsx`**
- Pass `instancia_id: instance.id` when invoking `send-whatsapp` (the instance object already has the id)

**6. `src/hooks/useAutoSend.tsx`**
- Pass `instancia_id` from the uazapi config if available

This approach ensures every outgoing message from any flow appears in the inbox automatically.


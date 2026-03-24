

## Plan: Implement WhatsApp Voice Call Campaigns via UAZAPI

### Summary
Add real WhatsApp voice call functionality using UAZAPI's two-step flow: initiate call → webhook receives "answered" → play audio on active call. This builds on the existing Campanhas de Voz page and infrastructure.

### Important caveat
The UAZAPI endpoints `/call/make`, `/call/play-audio`, and `/call/hangup` are **assumed** based on your description. These endpoints need to be verified against UAZAPI's actual documentation. The implementation will include these as configurable placeholders.

---

### Database changes (migration)

Add columns to `voice_campaign_contacts` to support call tracking:

```sql
ALTER TABLE voice_campaign_contacts 
  ADD COLUMN IF NOT EXISTS call_id TEXT,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration INTEGER,
  ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'audio_message';
```

Add a column to `voice_campaigns` to track the campaign mode:

```sql
ALTER TABLE voice_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'audio_message';
```

---

### New Edge Function: `voice-campaign-call`

Creates a new edge function `supabase/functions/voice-campaign-call/index.ts` that:
- Receives: `campaign_id`, `contact_id`, `phone_number`, `server_url`, `instance_token`
- Calls UAZAPI `POST {server_url}/call/make` with `{ number: phone_number }`
- Stores the returned `call_id` in `voice_campaign_contacts`
- Updates contact status to `'chamando'` (calling)

### Update Edge Function: `whatsapp-chatbot`

Add call event handling at the top of the webhook handler (before message processing):
- Detect event type `call` in the webhook payload
- When `status === 'answered'`:
  1. Look up contact by phone number in `voice_campaign_contacts` where `status = 'chamando'`
  2. Fetch the campaign's `audio_url`
  3. Call UAZAPI `POST {server_url}/call/play-audio` with `{ call_id, audio: audio_url }`
  4. Update contact: `status = 'atendido'`, `answered_at = now()`
- When `status === 'missed'` or `'rejected'`:
  - Update contact status accordingly
- Return early (don't process as chatbot message)

### Frontend changes: `src/pages/CampanhasVoz.tsx`

1. **Campaign type toggle** — when creating a new campaign, add a selector:
   - "Mensagem de Áudio" (current behavior, sends PTT)
   - "Chamada de Voz" (new, initiates calls)

2. **Modified `startCampaign`** — when campaign type is `'chamada'`:
   - Instead of calling `send-whatsapp-audio`, call `voice-campaign-call`
   - After initiating the call, don't wait for completion — the webhook handles the rest
   - Still uses round-robin across selected WhatsApp instances
   - Still uses 5-15 min random delay between calls

3. **New status badges** — display `'chamando'`, `'atendido'`, `'não atendeu'`, `'rejeitado'` with appropriate colors

4. **Auto-refresh** — enable realtime subscription or polling on `voice_campaign_contacts` to show live status updates as webhook events come in

### Config.toml update

```toml
[functions.voice-campaign-call]
verify_jwt = false
```

---

### Technical details

- The webhook (`whatsapp-chatbot`) already receives all events. We add a check at the top for call-type events and return early before chatbot processing.
- The `voice-campaign-call` edge function uses the same UAZAPI auth pattern (token header) as existing functions.
- Contact matching in webhook uses phone number normalization (strip country code prefix variations).
- If `/call/play-audio` doesn't exist in UAZAPI, the code will have a clear placeholder comment indicating where to adapt.


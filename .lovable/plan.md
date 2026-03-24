

## Recommendation: Audio Message Campaign via WhatsApp

Since automated voice calls are not possible through WhatsApp/UAZAPI, the closest achievable alternative is a **bulk audio message campaign** — sending pre-recorded audio files as WhatsApp voice messages to your contact list.

### What this would include

1. **New page "Campanhas de Voz"** accessible from the sidebar
2. **Audio upload** — user uploads MP3/M4A, stored in a new storage bucket
3. **Contact selection** — pick from existing agreements (acordos) or devedores, with checkboxes
4. **Bulk send** — sends the audio as a WhatsApp voice message to each contact with randomized 5-15 min delays (same pattern as text bulk sends)
5. **Campaign tracking** — database tables to log which contacts received the audio, status, timestamps
6. **Reports** — table showing sent/failed/pending with export to Excel

### Database tables
- `voice_campaigns` (id, user_id, name, audio_url, status, created_at)
- `voice_campaign_contacts` (id, campaign_id, telefone, nome, status, enviado_em, erro)

### Edge function
- `send-whatsapp-audio` — new function using UAZAPI's audio sending endpoint

### Alternative: Twilio for real phone calls
If you truly need automated phone calls with audio playback, I can integrate **Twilio** which supports:
- Programmatic outbound calls
- Playing pre-recorded audio when the person answers
- Call status webhooks (answered, busy, no-answer)
- Call duration tracking

This would require a Twilio account and has per-minute costs.

---

**Which approach would you like me to implement?**
1. WhatsApp audio message campaigns (sends audio files as messages)
2. Twilio phone call campaigns (actual voice calls with audio playback)
3. Both


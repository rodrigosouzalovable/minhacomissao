

## Fix: Duplicate Audio Sends

### Root Cause
The `send-whatsapp-audio` edge function tries 3 JSON endpoints and 2 FormData endpoints in sequence. Multiple endpoints are succeeding in sending the audio, but the success detection (`response.ok && !data?.error`) is too strict -- it treats responses with any truthy `error` field as failures, even when the message was already delivered. This causes the loop to continue to the next endpoint, which sends again.

### Solution
Since we now know `/send/media` with `{ number, type: 'ptt', file }` works, simplify the function to use only that single endpoint. Remove the fallback chain entirely. If that one endpoint fails, return the error directly instead of trying alternatives that could also deliver the message.

### Changes

**`supabase/functions/send-whatsapp-audio/index.ts`**:
- Remove the multi-endpoint loop and FormData fallback
- Send a single request to `${cleanUrl}/send/media` with `{ number, type: 'ptt', file: audio_url }`
- Treat any `response.ok` as success (don't check `data.error` since UAZAPI may include non-critical error fields)
- Remove unused helper functions (`downloadAudioFile`, `buildFormData`, `inferFileName`)
- Keep the clean phone formatting and CORS handling

This is a minimal, focused fix -- the frontend sending loop is correct and doesn't need changes.


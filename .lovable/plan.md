

## Plan: Otimizar Custos — Cron, Modelos IA e Funções

### 1. Reduzir frequência do cron `process-whatsapp-queue`

Change from every 5 minutes to every 10 minutes via SQL (drop old job, create new one). This cuts executions from ~8,640/month to ~4,320/month.

```sql
SELECT cron.unschedule('process-whatsapp-queue-5min');
SELECT cron.schedule('process-whatsapp-queue-10min', '*/10 * * * *', ...);
```

### 2. Trocar modelos de IA mais caros por versões mais baratas

Current usage and proposed changes:

| Function | Current Model | Proposed | Rationale |
|---|---|---|---|
| `extract-acordo-data` | gemini-2.5-flash | gemini-2.5-flash-lite | Simple data extraction |
| `extract-pdf-acordo` | gemini-2.5-flash | gemini-2.5-flash-lite | Structured extraction via tool call |
| `extract-texto-acordo` | gemini-3-flash-preview | gemini-2.5-flash-lite | Text extraction from images |
| `transcribe-audio` | gemini-2.5-flash | gemini-2.5-flash-lite | Audio transcription |
| `teach-chatbot` | gemini-2.5-flash | gemini-2.5-flash-lite | Knowledge processing |
| `gerar-termo-acordo` | gemini-3-flash-preview | gemini-2.5-flash | Document generation (needs quality) |
| `process-cobmais-video` | gemini-2.5-pro | gemini-2.5-flash | Video analysis (downgrade from Pro) |
| `analyze-cobmais-screen` | gemini-2.5-pro | gemini-2.5-flash | Screen analysis (downgrade from Pro) |

**Keep unchanged** (already optimal or need quality):
- `whatsapp-chatbot` — already uses flash-lite for most calls
- `gerar-estrategia-cobranca` — complex reasoning, keep gemini-3-flash-preview
- `chat-cobmais-knowledge` — complex knowledge chat, keep gemini-3-flash-preview
- `process-pos-atendimento` — already uses flash-lite

### 3. No obsolete Edge Functions to remove

All 29 functions are actively referenced in the frontend code or called by other functions/cron jobs. None are candidates for removal.

---

### Technical Details

- Cron change requires a database migration using `cron.unschedule` + `cron.schedule`
- Model changes are simple string replacements in each edge function's `index.ts`
- Estimated cost reduction: ~50% on cron executions + ~30-60% on AI token costs depending on usage patterns


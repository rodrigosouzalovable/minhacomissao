## Verificação de saúde / banimento das instâncias Meta

Adicionar uma forma de checar, sob demanda, se cada número Meta WhatsApp (ex.: IPHONE B7, B8) está **conectado, restringido ou banido** — usando os campos oficiais da Graph API da Meta.

### O que a Meta expõe (Graph API v21.0)

Para cada `phone_number_id` cadastrado:
`GET https://graph.facebook.com/v21.0/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status,status,throughput,messaging_limit_tier,platform_type,account_mode`

Campos relevantes:
- **`status`** — `CONNECTED`, `FLAGGED`, `RESTRICTED`, `PENDING`, `DISCONNECTED`
- **`quality_rating`** — `GREEN` / `YELLOW` / `RED` (RED = quase banimento)
- **`messaging_limit_tier`** — `TIER_250` / `1K` / `10K` / `100K` / `UNLIMITED`
- **`name_status`** — `APPROVED` / `PENDING_REVIEW` / `DECLINED`
- **`throughput`** — capacidade msg/s
- **`account_mode`** — `LIVE` / `SANDBOX`

E no nível da WABA (uma chamada por `business_account_id`, se cadastrado):
`GET /{waba_id}?fields=account_review_status,business_verification_status,ban_info` — o objeto `ban_info` aparece se a WABA foi banida.

### Implementação

**1. Novo edge function `check-meta-instance-health`** (`supabase/functions/check-meta-instance-health/index.ts`)
- Body: `{ instancia_id }` (ou sem body → checa todas as ativas).
- Para cada instância: faz o GET acima usando `access_token` salvo em `meta_whatsapp_instances`.
- Se a instância tiver `business_account_id` (campo já existente — confirmar; se não tiver, pular essa parte), chama também o endpoint da WABA para pegar `ban_info`.
- Retorna `{ results: [{ instancia_id, nome, status, quality_rating, messaging_limit_tier, name_status, throughput, ban_info, error }] }`.
- Persiste o snapshot em colunas novas em `meta_whatsapp_instances` (`saude_status`, `saude_quality`, `saude_tier`, `saude_checked_at`, `saude_ban_info jsonb`) — migration SQL.

**2. Migration SQL**
```sql
ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS saude_status text,
  ADD COLUMN IF NOT EXISTS saude_quality text,
  ADD COLUMN IF NOT EXISTS saude_tier text,
  ADD COLUMN IF NOT EXISTS saude_name_status text,
  ADD COLUMN IF NOT EXISTS saude_ban_info jsonb,
  ADD COLUMN IF NOT EXISTS saude_checked_at timestamptz;
```
(sem GRANT/RLS extra — tabela já configurada).

**3. UI em `src/pages/EnvioMeta.tsx`**
- No card "2. Instâncias", botão no topo **"Verificar saúde"** (ícone HeartPulse). Ao clicar, invoca a function e atualiza `instancias` no estado.
- Em cada linha de instância: badge colorida com `status` + `quality_rating` (GREEN=verde, YELLOW=amarelo, RED=vermelho destrutivo) + tier atual + horário do último check.
- Se `status` for `FLAGGED`/`RESTRICTED` ou `ban_info` presente: alerta em vermelho com link "Ver detalhes" abrindo dialog com JSON cru retornado pela Meta + instruções ("Acesse business.facebook.com → WhatsApp Manager → Status da conta para apelar").
- Botão adicional **"Enviar mensagem de teste"** ao lado de cada instância: dispara o template selecionado para um número fixo digitado em um prompt (rápido sanity-check sem mexer no fluxo de massa).

**4. Diagnóstico do caso atual ("não recebi as 2 mensagens")**

Importante deixar claro no painel: a Meta retorna `messages.id` com `message_status: accepted` mesmo quando o número de destino:
- Está em opt-out de marketing (template MARKETING bloqueado pelo usuário)
- Bloqueou seu número
- Não abriu a janela de 24h e o template foi reprovado individualmente
- Recebeu mas o template caiu em "spam/aba de marketing" no app

A função de **verificação de saúde** mostra se o problema é da **sua instância** (RESTRICTED/quality RED). Se a instância estiver GREEN/CONNECTED, o problema é entrega individual — aí o ideal é plugar o **webhook de status Meta** (`sent`/`delivered`/`read`/`failed`) para refletir entrega real no painel de detalhamento. Isso fica fora deste plano (passo seguinte se você quiser).

### Fora de escopo
- Webhook de delivery status (proposta separada).
- Alterar fluxo de envio existente.

### Riscos / custo
- 1 request HTTP Meta por instância no clique — custo zero adicional Lovable Cloud.
- Token Meta já está salvo; nenhum secret novo.
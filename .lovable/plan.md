## Diagnóstico

O envio pela LD 06 Fernanda para 5562991672674 tem os seguintes fatos confirmados no banco:

- Item marcado como `enviado` com `wa_message_id = wamid.HBgMNTU2...` (Meta aceitou a chamada e devolveu wamid).
- Em `meta_whatsapp_envios_log` existe **apenas** o evento `sent` — não há evento `delivered`, `read` nem `failed`.
- Instância LD 06: `saude_status=CONNECTED`, `saude_quality=GREEN`, `ativo=true`, sem pausa.
- **Ponto crítico:** `saude_name_status = NON_EXISTS` na LD 06 (o Display Name não está aprovado / não está publicado no diretório do WhatsApp).
- Template `solicitacao_de_renegociacao` está `approved` / `UTILITY`, então não é bloqueio de template.

Aceito no dashboard = a Meta devolveu 200 + wamid. Isso **não garante** entrega. Como não chega nenhum callback `delivered/failed`, a causa provável é uma destas duas — e o plano investiga as duas em ordem:

1. Webhook da Meta não está chegando de volta no nosso backend para essa instância (assinatura webhook do WABA sem `messages`/`message_status`, ou verify token diferente).
2. A Meta está fazendo *silent drop* da mensagem (comum quando `name_status ≠ APPROVED`, spam score alto, ou o destinatário bloqueou o número business).

## Plano

### 1. Verificar do lado da Meta o que aconteceu com o wamid
Chamar a Graph API com o access_token da LD 06 para:
- `GET /{phone_number_id}?fields=name_status,quality_rating,verified_name,throughput` → confirmar `name_status` real e se a Meta considera o número apto a enviar.
- `GET /{phone_number_id}/message_qr_codes` / `messaging_analytics` para conferir se a mensagem consta como entregue no lado da Meta (o wamid não é consultável diretamente, mas conseguimos ver a métrica agregada do dia).
- `GET /{waba_id}/subscribed_apps` → confirmar que nosso app está assinado.

Isso será feito por uma nova Edge Function `meta-diagnose-instance` (invocada pela UI num botão “Diagnosticar” dentro do card da instância) que retorna esse laudo consolidado.

### 2. Reprocessar o webhook / garantir que estamos assinando os eventos certos
- Verificar em `supabase/functions/meta-webhook/index.ts` (ou nome equivalente) se estamos gravando `delivered/read/failed` em `meta_whatsapp_envios_log`.
- Se sim, o problema é falta de assinatura na Meta → a nova função `meta-diagnose-instance` também chama `POST /{waba_id}/subscribed_apps` para (re)assinar campos `messages` e `message_status_updates`.

### 3. Sinalizar no envio em massa quando o `name_status` da instância não é `APPROVED`
Hoje o worker de rajada só respeita `BANNED/FLAGGED`. Quando `saude_name_status ∈ {NON_EXISTS, DECLINED, NONE}`, a Meta frequentemente aceita e descarta silenciosamente. O plano é:
- Em `pick-meta-instance` e no preview do `EnvioMeta.tsx`: exibir aviso amarelo “Display Name não aprovado — mensagens podem ser aceitas mas não entregues”.
- Não bloquear o envio (o usuário decide), apenas avisar antes de iniciar a campanha e dentro do `CampanhaDetalheDialog` quando `Aceito > 0` e `Entregue == 0` após 60s.

### 4. Rodar o diagnóstico agora contra a LD 06
Ao aprovar o plano, a primeira ação é invocar a nova função contra a LD 06 e trazer o laudo real da Meta — só assim a “correção” fica definitiva (webhook vs. name_status vs. block do destinatário). O resultado vai direcionar se o próximo passo é: (a) reassinar webhook, (b) aprovar Display Name no Business Manager, ou (c) confirmar que o destinatário bloqueou o número.

## Detalhes técnicos

- Nova função: `supabase/functions/meta-diagnose-instance/index.ts` — recebe `{ instancia_id, wamid? }`, chama Graph API v20.0 com o `access_token` da instância, devolve `{ name_status, quality_rating, throughput, subscribed, analytics_today, recommendation }`.
- Sem novas tabelas. Sem migração.
- UI: botão “Diagnosticar” no card da instância em `ConfigMeta.tsx` e alerta contextual no `CampanhaDetalheDialog.tsx` quando `aceitos > 0 && entregues == 0` após 60s.
- Nada muda no motor de rajada além do aviso — sem impacto de custo (só chamadas Graph sob demanda).
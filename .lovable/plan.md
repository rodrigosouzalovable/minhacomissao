
# Relatório: Webhook Meta WhatsApp Cloud API — Guia de Replicação

Vou gerar um documento único (formato Markdown, entregue em uma mensagem no chat que seu amigo pode colar direto no prompt da Lovable dele) contendo tudo necessário para replicar o webhook oficial da Meta que roda neste projeto.

## O que o relatório vai conter

### 1. Visão geral da arquitetura
- Papel de cada peça: Meta Cloud API → Edge Function (webhook) → tabelas do banco → Realtime → UI Inbox.
- Fluxo GET (verificação do `hub.verify_token`) e POST (recebimento de mensagens/status/templates).

### 2. Pré-requisitos na Meta (Facebook Developers)
- Criar App tipo Business, adicionar produto "WhatsApp".
- Obter: `WABA_ID`, `PHONE_NUMBER_ID`, `System User Access Token` permanente, `App Secret`.
- Registrar número, criar templates (ex.: `lembrete_envio_boleto` com `{{1}}` e `{{2}}`).
- Configurar Webhook: URL da edge function, Verify Token (string qualquer criada por ele), assinar campos `messages`, `message_template_status_update`, `phone_number_quality_update`, `account_update`.

### 3. Secrets/variáveis a configurar no Lovable Cloud
Lista com nome, propósito e onde obter:
- `META_VERIFY_TOKEN` (mesma string configurada no painel Meta)
- `META_APP_SECRET` (validação `X-Hub-Signature-256`)
- `META_SYSTEM_USER_TOKEN` (opcional, se ele quiser baixar mídia)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (já vêm automáticas no Lovable Cloud)

### 4. Estrutura de banco de dados
SQL completo de:
- `meta_whatsapp_instances` (colunas principais que o webhook lê/atualiza: `id`, `waba_id`, `phone_number_id`, `display_phone`, `access_token`, `qualidade`, `saude_tier`, `ativo`).
- `meta_whatsapp_mensagens` (armazena inbound/outbound, com `wa_message_id` como chave de deduplicação).
- `meta_whatsapp_envios_log` (status callbacks: sent/delivered/read/failed).
- `meta_whatsapp_contatos` (contatos, `pushName`, dedup por `phone_number_id + telefone`).
- `meta_whatsapp_templates` (estado dos templates aprovados/rejeitados).
- Índices, RLS e GRANTs necessários.

### 5. Código completo das Edge Functions
Vou incluir o conteúdo integral (colável direto no Lovable) de:

**a) `supabase/functions/meta-whatsapp-webhook/index.ts` (~733 linhas)**
- Handler GET: valida `hub.mode=subscribe` + `hub.verify_token`.
- Handler POST:
  - Validação de assinatura HMAC SHA256 com `META_APP_SECRET`.
  - Roteamento por `entry[].changes[].field`:
    - `messages` → grava inbound/outbound, dedup por `wa_message_id`, download de mídia (Graph API `/v21.0/<mediaId>` → storage bucket `inbox-media`).
    - `statuses` → atualiza `meta_whatsapp_envios_log` + detecção de instância bloqueada (`isMetaInstanceRestrictedError`).
    - `message_template_status_update` → sincroniza `meta_whatsapp_templates`.
    - `phone_number_quality_update` / `account_update` → atualiza qualidade e tier da instância.
  - Match por sufixo de 8 dígitos (padrão do projeto).
  - Sempre responde `200 OK` rapidamente (evita retries agressivos da Meta).

**b) `supabase/functions/meta-subscribe-waba/index.ts`**
- Faz a chamada Graph API para assinar `messages`, `message_template_status_update`, etc. no WABA do usuário. Usado uma vez por instância no onboarding.

**c) `supabase/config.toml` — trecho relevante**
```toml
[functions.meta-whatsapp-webhook]
verify_jwt = false
```
(webhook público — a autenticação é feita via assinatura HMAC).

### 6. Passo a passo de deploy no projeto do amigo
1. Criar as tabelas (rodar SQL fornecido).
2. Colar as duas edge functions em `supabase/functions/...`.
3. Adicionar `verify_jwt = false` no `config.toml`.
4. Cadastrar os 3 secrets no Lovable Cloud (`META_VERIFY_TOKEN`, `META_APP_SECRET`, opcional token).
5. Copiar a URL da função (`https://<project>.supabase.co/functions/v1/meta-whatsapp-webhook`) e colar no painel Meta → Webhook → Callback URL + Verify Token → clicar "Verify and Save".
6. Assinar os campos desejados.
7. Cadastrar cada instância na tabela `meta_whatsapp_instances` com `waba_id`, `phone_number_id`, `display_phone`, `access_token`.
8. Chamar `meta-subscribe-waba` uma vez por WABA.
9. Testar: enviar mensagem para o número → verificar row em `meta_whatsapp_mensagens` e log de mídia em `inbox-media`.

### 7. Troubleshooting (erros mais comuns que já resolvemos aqui)
- "hub.verify_token mismatch" → secret errado.
- "Invalid signature" → `META_APP_SECRET` diferente do App Secret real (não confundir com token).
- Mídia não baixa → `access_token` da instância expirou ou sem permissão `whatsapp_business_messaging`.
- Mensagens duplicadas → conferir dedup por `wa_message_id` (unique constraint).
- Status ficando "sent" e nunca "delivered" → webhook não está assinado no campo `messages` (statuses vêm no mesmo evento).
- Conversa "sumindo" no inbox → política de retenção; incluímos como não deletar conversas com resposta do cliente.

### 8. Notas de segurança
- Nunca expor `access_token` no frontend.
- Assinatura HMAC obrigatória em produção.
- RLS restrita: apenas `service_role` escreve nas tabelas Meta; usuários leem via policies escopadas por `user_id` da instância.

## Entrega
- Uma única mensagem em Markdown, pronta para colar no chat da Lovable do amigo dele.
- Sem alterações no seu projeto atual (é apenas leitura/exportação).

Confirme para eu gerar o relatório completo.

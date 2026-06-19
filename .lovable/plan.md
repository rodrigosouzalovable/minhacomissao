
# Plano: Integração HookCloud para Acionamento em Massa

Adicionar a **API Oficial da Meta via HookCloud** como provedor paralelo ao UAZAPI, usado **apenas no Acionamento em Massa**. UAZAPI continua intacto para Lembretes, Inbox, Chatbot, Aquecimento e Voz.

## O que será construído

### 1. Banco de dados (3 tabelas novas)

**`meta_whatsapp_instances`** — uma linha por número/BM conectado (suporta os 5 iniciais e escala para 100+)
- `id`, `user_id`, `nome` (apelido), `phone_number_id` (Meta), `waba_id`, `business_id`, `display_phone`, `access_token`, `webhook_verify_token`, `tier_diario` (250/1k/10k/100k), `enviados_hoje`, `ultimo_reset`, `ativo`, `criado_em`

**`meta_whatsapp_templates`** — templates HSM sincronizados da Meta
- `id`, `instancia_id`, `nome_template` (ex: `lembrete_renegociacao_novomundo`), `categoria` (utility/marketing/auth), `idioma` (pt_BR), `status` (approved/pending/rejected), `body_text`, `variaveis` (jsonb com `{{1}}={{NAME}}`), `sincronizado_em`

**`meta_whatsapp_envios_log`** — log de envios para dedup diário e métricas
- `id`, `instancia_id`, `user_id`, `telefone`, `template_nome`, `status` (sent/delivered/read/failed/replied), `wa_message_id`, `erro`, `enviado_em`

Todas com RLS por `user_id` + admin override, GRANT para `authenticated` e `service_role`.

### 2. Edge Functions (4 novas)

- **`send-whatsapp-meta`** — envia template HSM via `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` usando o token da instância. Body com `type: "template"`, `template.name`, `template.components` com variáveis substituídas.
- **`meta-whatsapp-webhook`** — endpoint público para receber respostas e status (delivered/read/replied). Faz `GET` com `hub.verify_token` e `POST` com payload da Meta. Grava resposta em `whatsapp_mensagens` com `provedor='meta'` para aparecer no Inbox normalmente.
- **`meta-sync-templates`** — chama `GET /v21.0/{waba_id}/message_templates` e popula `meta_whatsapp_templates`. Botão "Sincronizar Templates" na UI dispara isso.
- **`test-meta-connection`** — valida `access_token` + `phone_number_id` chamando `GET /v21.0/{phone_number_id}` antes de salvar a instância.

Adicionar coluna `provedor` em `whatsapp_mensagens` (default `'uazapi'`, valor `'meta'` para mensagens via HookCloud) para o Inbox unificar respostas.

### 3. UI (3 telas/abas novas)

**`/configurar-meta`** — nova página acessível pelo menu Admin:
- Lista das instâncias Meta cadastradas (5 inicialmente, escala)
- Botão "+ Nova Instância Meta" → form: nome, phone_number_id, waba_id, business_id, access_token, tier
- Botão "Testar conexão" antes de salvar (chama `test-meta-connection`)
- Botão "Sincronizar Templates" por instância
- Mostra webhook URL pronta para o usuário colar no HookCloud:
  `https://cymdrkeukockakfzjeen.supabase.co/functions/v1/meta-whatsapp-webhook`

**Aba "Templates HSM"** dentro de `/configurar-meta`:
- Lista templates aprovados/pendentes por instância
- Para cada template, mostra preview do body e as variáveis detectadas (`{{1}}`, `{{2}}`)
- Editor de mapeamento: vincula cada `{{N}}` a um campo do cliente (`{nome}`, `{primeiro_nome}`, `{saldo}`, `{cpf}`, `{atraso}`, `{avista}`, `{parcelado}`)
- Exemplo: template `lembrete_renegociacao_novomundo` com body  
  `"{{1}}, seu contrato na loja Novo Mundo possui uma pendência..."` → mapear `{{1}}` para `{primeiro_nome}`

**Atualizar `/acionamento`** (página existente):
- Adicionar seletor no topo: **Provedor → UAZAPI (texto livre) | Meta Oficial (HookCloud)**
- Quando "Meta Oficial" estiver selecionado:
  - Esconde caixa de texto livre e abas de mensagens
  - Mostra dropdown "Template HSM" com os templates aprovados
  - Mostra preview do template já com as variáveis substituídas pelo primeiro cliente da lista
  - Mostra seletor de instâncias Meta (multi-select, padrão = todas ativas)
  - Mostra contador "X / tier_diario enviados hoje" por instância
- Lógica de envio: round-robin entre instâncias Meta selecionadas, respeitando `tier_diario`, mesmo delay configurável (min/max segundos) já existente
- Resultado salvo em `meta_whatsapp_envios_log` + cria registro em `whatsapp_mensagens` com `provedor='meta'` para aparecer no Inbox

### 4. Secret

Um único secret novo: **`WHATSAPP_META_VERIFY_TOKEN`** (string aleatória que o usuário cola tanto no HookCloud quanto guardamos para validar o webhook GET). Os access tokens da Meta ficam **por instância no banco** (não como secret global), porque serão até 100+ tokens diferentes.

## O que NÃO muda

- UAZAPI continua sendo o padrão e único provedor para: Lembretes, Inbox (envio manual), Chatbot, Aquecimento, Campanhas de Voz
- Templates de mensagem livres (aba Modelos de Mensagem) continuam funcionando para UAZAPI
- Nenhuma tabela existente é apagada ou migrada
- Round-robin, daily caps, anti-ban do UAZAPI permanecem iguais

## Fluxo de uso após implementação

1. Você assina HookCloud, conecta 5 números, copia para cada um: `phone_number_id`, `waba_id`, `access_token`
2. Vai em `/configurar-meta` → cria as 5 instâncias colando esses dados
3. Cola a webhook URL no painel HookCloud de cada número
4. Cria o template `lembrete_renegociacao_novomundo` no painel da Meta (aguarda aprovação ~1h-24h)
5. Em `/configurar-meta` → clica "Sincronizar Templates" → mapeia `{{1}} = {primeiro_nome}`
6. Em `/acionamento` → escolhe provedor "Meta Oficial" → seleciona o template → cola a lista de CPFs/telefones → dispara
7. Respostas dos clientes aparecem no Inbox normal (com badge "Meta" para diferenciar)

## Detalhes técnicos relevantes

- Endpoint Meta: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`
- Header: `Authorization: Bearer {access_token}`
- Body template: `{ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: "João" }] }] } }`
- Webhook Meta envia `entry[].changes[].value.messages[]` (mensagens recebidas) e `entry[].changes[].value.statuses[]` (delivered/read)
- Tiers Meta: começa em 250 conversas/dia, sobe automaticamente para 1k → 10k → 100k conforme qualidade e verificação da BM
- Custo direto Meta: ~R$ 0,08 (utility) / R$ 0,30 (marketing) por conversa de 24h — pago direto à Meta, não passa pelo nosso sistema
- HookCloud é só a ponte de onboarding (R$ 97/mês), não cobra por mensagem

## Não incluído neste plano (pode ser feito depois)

- Migração dos Lembretes para Meta (você quis manter UAZAPI)
- Dashboard de métricas Meta (delivered/read/replied rate) — adicionável depois sem retrabalho
- Envio de mídia (imagem/PDF) via Meta — começamos só com texto/template
- Janela 24h de resposta livre (quando cliente responde, podemos mandar texto livre por 24h) — funcionalidade futura

Após sua aprovação, posso implementar tudo de uma vez ou dividir em fases (1: banco + config, 2: envio + UI acionamento, 3: webhook + inbox).

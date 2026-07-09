
# Criação de Templates Meta em Lote (27 WABAs)

Cadastrar um template uma única vez no MEUS ACORDOS e replicá-lo automaticamente em todas (ou nas selecionadas) as instâncias Meta oficiais, com acompanhamento de status de aprovação.

## Respostas às perguntas de viabilidade

- **API Meta permite criar via POST?** Sim. Endpoint: `POST https://graph.facebook.com/v21.0/{WABA_ID}/message_templates` com `Authorization: Bearer {ACCESS_TOKEN}` e body JSON `{name, language, category, components:[HEADER?, BODY, FOOTER?, BUTTONS?]}`. Cada WABA exige uma chamada — não há endpoint "bulk multi-WABA". Vamos fazer 1 request por WABA, sequencial com pequeno delay.
- **Limites Meta:** 100 templates criados/hora por WABA, 250/dia por WABA, 6000 templates totais por WABA. Nunca chegaremos perto disso (27 WABAs × 1 template = 27 requests).
- **Aprovação:** normalmente minutos a algumas horas. Preferimos **webhook** `message_template_status_update` (já podemos assinar na WABA) + fallback de polling via cron a cada 30 min nos templates ainda `PENDING`.
- **Botões:** sim, suportamos `QUICK_REPLY`, `URL` e `PHONE_NUMBER` (CTA). Botões `URL` com WhatsApp direto continuam bloqueados — orientar uso do redirect `/r/boleto` já existente.
- **Custo Lovable Cloud:** desprezível — 27 fetches HTTP + gravações no DB por lote; webhook e cron não geram carga relevante.

## Fases

### Fase 1 — Schema
Nova migração criando:

- `meta_templates_mestre` — template canônico (nome, categoria, idioma, body, header {tipo,texto}, footer, botões JSONB, exemplo JSONB, criado_por).
- `meta_templates_instancia` — 1 linha por (mestre × instância): `status` (`PENDENTE|ENVIADO|APPROVED|PENDING|REJECTED|PAUSED|FALHA_ENVIO`), `meta_template_id`, `erro`, timestamps.
- `meta_templates_lote_log` — auditoria de cada lote (totais, detalhes).

Todas com GRANT para `authenticated`/`service_role`, RLS admin-only via `is_admin_user(auth.uid())`, trigger `updated_at`.

### Fase 2 — Edge Functions

- `meta-criar-template-lote` (principal): recebe `{mestre_id, instancia_ids[]}`, monta o payload Meta a partir do mestre, faz `POST` para cada WABA sequencialmente com 300–500ms de delay, grava `meta_template_id` e `status` inicial em `meta_templates_instancia`, retorna resumo e grava linha em `meta_templates_lote_log`.
- `meta-verificar-status-templates` (cron 30 min): para cada WABA distinta com filhos `PENDING`, faz `GET /{WABA_ID}/message_templates?fields=name,language,status,id,rejected_reason` e atualiza `meta_templates_instancia`.
- Extender `meta-whatsapp-webhook` para tratar `message_template_status_update` e atualizar a linha correspondente em tempo real.

Nenhuma edge extra de "criar único" — a função em lote já cobre 1..N instâncias.

### Fase 3 — UI

Nova página `/admin/meta-templates` (link no menu, admin-only) com 3 abas:

1. **Criar Template**
   - Formulário: nome (slug snake_case validado), categoria, idioma (default `pt_BR`), corpo com contador, botão para inserir `{{1}}`, `{{2}}`…, header opcional (TEXT/IMAGE/DOCUMENT), footer, botões (QUICK_REPLY, URL, PHONE) até 3, exemplos de variáveis.
   - Preview WhatsApp reaproveitando `TemplateWhatsAppPreview.tsx`.
   - Ao salvar: grava mestre + abre modal da Fase 4.

2. **Aplicar em lote**
   - Lista de mestres criados.
   - Seleção de instâncias: checkbox "Todas as 27" + lista com search e status atual (ícone verde se já `APPROVED` naquela instância, cinza se ausente, âmbar `PENDING`, vermelho `REJECTED`).
   - Botão "Enviar para Meta" chama `meta-criar-template-lote` e mostra progresso ao vivo (subscription realtime em `meta_templates_instancia`).

3. **Status & Aprovação**
   - Grid `mestre × instância` (linhas=mestres, colunas resumidas por status count), clique expande detalhes com `rejected_reason`.
   - Botão "Reenviar falhas" chama a mesma edge só nas instâncias com `FALHA_ENVIO` ou `REJECTED`.

### Fase 4 — Integração com Envio em Massa

Em `EnvioMeta.tsx` e `pick-meta-instance`, ao escolher um template, filtrar por `meta_templates_instancia.status = 'APPROVED'` na instância candidata. Instâncias sem o template aprovado ficam elegíveis apenas se outra instância tiver — assim o round-robin evita "template not found".

### Fase 5 — Cron

`select cron.schedule('meta-templates-status', '*/30 * * * *', ...)` via tool `insert` (contém URL/anon key do projeto), invocando `meta-verificar-status-templates`. Webhook cobre o caso rápido; cron garante consistência.

## Cronograma estimado

- Fase 1 (schema): 1 mensagem.
- Fase 2 (3 edge functions + webhook extend): 1–2 mensagens.
- Fase 3 (UI 3 abas + rota + menu): 2 mensagens.
- Fase 4 (integração envio): 1 mensagem.
- Fase 5 (cron): 1 mensagem.

Total: ~5–7 iterações.

## Fora do escopo (por enquanto)

- Edição/versionamento de templates já criados na Meta (a Meta trata como novo template).
- Upload de mídia de header para templates com IMAGE/DOCUMENT (fica para v2, exige `resumable upload` na Graph API).
- Templates AUTHENTICATION com OTP (não é caso de uso atual).

Confirma que sigo com a Fase 1 (migração) já na próxima etapa, ou quer ajustar algo antes?


# Nova URL /avatusbarbearia com isolamento multi-tenant real das abas Meta

## Objetivo

Criar `meusacordos.com.br/avatusbarbearia` como uma área espelho das 4 abas Meta (Envio, API Oficial, Inbox, Cobranças), mas com dados **totalmente isolados** por tenant. O admin master (você) enxerga os dados do Avatus quando entra nessa URL; o usuário `avatusbarbearia@gmail.com` só enxerga os dele. A conta aparece em `/admin/usuarios` para edição normal de permissões.

## Aviso importante (custo e escopo)

Esse é o primeiro passo real de SaaS multi-tenant. Envolve:
- Adicionar `tenant_id` em ~20 tabelas Meta e reescrever RLS.
- Ajustar todas as edge functions Meta (envio, worker, inbox, lembretes, billing, webhooks) para respeitar tenant.
- Criar layout/rota nova sem duplicar código das páginas.

Vou fazer em **fases** para você aprovar cada uma antes de seguir. Este plano cobre a **Fase 1 (fundação)** — sem ela nada mais funciona. As Fases 2-4 ficam listadas para você aprovar depois.

---

## Fase 1 — Fundação de tenants (esta aprovação)

### 1.1 Modelo de tenant

Novas tabelas:
- `tenants` — `id`, `slug` (único, ex: `avatusbarbearia`), `nome`, `ativo`.
- `tenant_members` — `tenant_id`, `user_id`, `role_tenant` (owner/member). Um usuário pode pertencer a vários; admin master é membro implícito de todos via função helper.

Tenant "master" default é criado e associado ao seu user_id. Todas as linhas existentes das tabelas Meta recebem `tenant_id = master`.

### 1.2 Coluna `tenant_id` nas tabelas Meta

Adicionar `tenant_id uuid NOT NULL` (com default temporário = master até backfill, depois DROP DEFAULT) em:

`meta_whatsapp_instances`, `meta_whatsapp_contatos`, `meta_whatsapp_mensagens`, `meta_whatsapp_contato_etiquetas`, `meta_whatsapp_etiquetas`, `meta_whatsapp_envios_log`, `meta_whatsapp_templates`, `meta_templates_instancia`, `meta_templates_mestre`, `meta_envios_fila`, `envio_meta_job`, `envio_meta_job_item`, `meta_campanha_agendada`, `meta_campanha_item`, `meta_instance_pagamentos`, `meta_billing_snapshot`, `meta_billing_meta_mensal`, `meta_billing_alerts`, `meta_billing_guardrail`, `meta_billing_relatorio_config`, `meta_lembrete_config`, `meta_lembrete_log`, `meta_atendimento_fila`, `meta_atendimento_estado`, `meta_business_managers`, `meta_envio_pool_config`, `meta_whatsapp_config`, `meta_instance_daily_metrics`, `meta_templates_lote_log`, `meta_aquecimento_pares`, `meta_whatsapp_mensagens_rapidas`.

### 1.3 Helpers e RLS

- `public.current_tenant_id()` — lê tenant do header `x-tenant-id` (setado pelo front) ou fallback master.
- `public.user_can_access_tenant(uid, tenant)` — true se admin master OU membro do tenant.
- Reescrever todas as políticas RLS Meta para: `is_admin_user(auth.uid()) OR user_can_access_tenant(auth.uid(), tenant_id)`.

### 1.4 Frontend — contexto de tenant

- Novo `TenantContext` que:
  - Lê `slug` da URL (`/:tenantSlug/*` quando aplicável).
  - Resolve `tenant_id` e injeta `x-tenant-id` no cliente supabase via `global.headers` dinâmico.
- Nova rota `/avatusbarbearia/*` com layout dedicado (menu enxuto: 4 abas Meta).
- As páginas `EnvioMeta`, `ConfigurarMeta`, `InboxMeta`, `MetaBilling` são **as mesmas**, só passam a filtrar por `tenant_id` via RLS + queries com `.eq('tenant_id', current)`.

### 1.5 Criação do tenant Avatus

- Migração cria tenant `avatusbarbearia` (slug fixo).
- Você usa `/admin/usuarios` normal para criar o usuário `avatusbarbearia@gmail.com` (já existe fluxo). Depois, em **Editar Permissões**, um novo campo **"Tenants"** permite marcar `avatusbarbearia` — isso cria linha em `tenant_members`.
- O usuário faz login em `/auth` normal e é redirecionado para `/avatusbarbearia`.

### 1.6 Edge functions

Ajustar as funções Meta principais para receber `tenant_id` do JWT/headers e filtrar:
`send-whatsapp-meta`, `envio-meta-worker`, `envio-meta-massa-burst`, `meta-lembrete-tick`, `meta-webhook`, `parse-meta-invoice-pdf`, `meta-inbox-retention`, `meta-aquecimento-relatorio`.

Webhook Meta identifica tenant pela instância (`meta_whatsapp_instances.tenant_id`) — nada muda no lado da Meta.

---

## Fases seguintes (não incluídas nesta aprovação)

- **Fase 2**: Migrar business managers e faturas para consolidar cobrança por tenant.
- **Fase 3**: Convites e billing separado por tenant.
- **Fase 4**: Estender multi-tenant para outras áreas (acordos, inbox UAZAPI etc.) se você quiser revender o sistema completo.

---

## Detalhes técnicos

```text
Rotas:
/avatusbarbearia            → redirect /avatusbarbearia/envio-meta
/avatusbarbearia/envio-meta → <TenantGuard slug="avatusbarbearia"><EnvioMeta/></TenantGuard>
/avatusbarbearia/api-meta   → ConfigurarMeta
/avatusbarbearia/inbox      → InboxMeta
/avatusbarbearia/cobrancas  → MetaBilling
```

- `TenantGuard`: resolve slug → tenant_id → verifica `tenant_members` OU admin master → seta contexto.
- Cliente Supabase envolvido em wrapper que injeta header `x-tenant-id` em cada request (para RPCs e Storage; RLS usa `current_tenant_id()`).
- Backfill: `UPDATE ... SET tenant_id = <master>` para todas as linhas existentes antes de aplicar `NOT NULL`.
- Índices: `CREATE INDEX ON <tabela> (tenant_id)` em todas as ~30 tabelas para não regredir performance.

## Riscos

- Migração toca em muitas tabelas Meta ao mesmo tempo. Vou executar em uma migração única com backfill dentro da mesma transação para não deixar estado inconsistente.
- Edge functions Meta são críticas (envio real). Cada uma será ajustada com fallback: se `tenant_id` ausente, assume tenant master (compatibilidade retroativa).
- Sem separação de billing Meta: as instâncias do Avatus consomem seu Business Manager Meta. Confirme se ele terá WABA própria depois (Fase 2).

## Confirmação necessária antes de iniciar

1. Aprova iniciar pela **Fase 1** apenas (fundação + rota + acesso), sem billing separado?
2. O menu do Avatus deve ter só as 4 abas Meta, sem Dashboard, Acordos, etc.?

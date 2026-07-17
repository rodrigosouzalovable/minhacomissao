## Nova aba "Lembrete Meta" — envio automático via API Oficial

Cria uma nova aba que dispara lembretes de boleto de acordos ativos usando templates aprovados da Meta, todos os dias às 08:30 BRT, com round-robin entre as instâncias selecionadas.

### Regras de negócio

- **Universo**: Todos os `pagamentos` com `status='pendente'` de `acordos` com `status='ativo'`, de qualquer usuário do sistema.
- **Cadência**: envia quando `data_prevista` = hoje (D0) ou hoje+3 (D-3). Nada em domingo (adia para segunda 08:30).
- **Delay**: randômico 30–60s entre envios (uma mensagem por ciclo), round-robin real entre instâncias selecionadas.
- **Filtros de qualidade**: pula automaticamente instâncias RED/YELLOW ou fora do pool ativo (reaproveita `pick-meta-instance`).
- **Deduplicação**: cada `pagamento_id + tipo (D-3|D0) + data_ref` só envia 1 vez por dia (tabela de log).
- **Toggle ON/OFF**: campo `ativo` na config; se desligado, o cron termina sem enviar.
- **Notificações ao admin** (via WhatsApp API oficial, para 62991672674):
  - No fim do lote: resumo com totais (enviados, falhas, instâncias usadas).
  - A cada erro: mensagem imediata com nome da instância + erro retornado pela Meta.

### Interface — página `/admin/lembrete-meta`

- Toggle "Ativar envio automático" (grava em `meta_lembrete_config.ativo`).
- Seletor múltiplo de instâncias Meta (só lista as com pool ativo).
- Seletor de template para **D-3** e para **D0** (podem ser diferentes ou iguais).
- Mapeamento das variáveis do template: dropdown por variável com opções `{nome_cliente}` e `{data_vencimento}` (ou texto fixo).
- Preview do template com valores de exemplo.
- Configuração de delays (min/max, default 30/60s) e horário de início (default 08:30 BRT).
- Painel "Últimos disparos": data, total enviado, total falha, botão para ver detalhes.
- Botão "Testar agora (dry-run)" que simula sem enviar.
- Botão "Enviar agora" que dispara imediatamente sem esperar o cron.

### Backend

**1. Migração** — 2 novas tabelas:

- `meta_lembrete_config` (singleton por admin): `ativo`, `instancia_ids uuid[]`, `template_id_d3`, `template_id_d0`, `variaveis_map jsonb` ({"1":"nome_cliente","2":"data_vencimento"}), `min_seg`, `max_seg`, `hora_inicio` (default '08:30'), `notificar_telefone` (default '62991672674').
- `meta_lembrete_log`: `pagamento_id`, `tipo` (D-3|D0), `data_ref date`, `instancia_id`, `telefone`, `sucesso bool`, `erro text`, `wa_message_id`. UNIQUE(`pagamento_id`,`tipo`,`data_ref`).
- Ambas com RLS admin-only e GRANTs.

**2. Edge function `meta-lembrete-tick`** (Deno):
- Lê config; se `ativo=false` retorna.
- Se domingo: retorna skipped.
- Busca pagamentos D0 e D+3 pendentes com acordo ativo.
- Para cada pagamento: dedup no log; escolhe próxima instância via round-robin nos IDs configurados (respeitando qualidade/cota via `pick-meta-instance`); monta `variaveis` a partir do `variaveis_map`; chama `send-whatsapp-meta` com o template correto.
- Se erro: grava log com `sucesso=false`, notifica admin imediato via `send-whatsapp-meta` (usando 1ª instância saudável) com nome da instância e erro.
- Delay randômico 30–60s entre envios.
- No final: envia resumo para 62991672674 ("Lembrete Meta: X enviados, Y falhas, Z instâncias usadas").

**3. Cron** — via `pg_cron` + `pg_net`:
- Trigger diário 11:30 UTC (08:30 BRT), invoca `meta-lembrete-tick`.

### Custo (Lovable Cloud)

⚠️ Impacto: 1 execução/dia do cron + N chamadas a `send-whatsapp-meta` (uma por parcela D0/D-3). Sem polling adicional no frontend. Log em tabela indexada por `(data_ref,tipo)`.

### Arquivos

- `supabase/migrations/*_meta_lembrete.sql` (novas tabelas + cron)
- `supabase/functions/meta-lembrete-tick/index.ts` (nova função)
- `src/pages/LembreteMeta.tsx` (nova página)
- `src/App.tsx` + `src/components/layout/AppLayout.tsx` (rota + menu admin)
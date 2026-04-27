## Otimização do banco — pós upgrade SMALL

Limpar bloat, recuperar ~600MB de armazenamento e reduzir consumo de CPU/Egress sem tocar em **acordos** ou **pagamentos**.

### Garantia sobre acordos

**Nenhuma das 4 etapas abaixo apaga, modifica ou desativa acordos, parcelas (`pagamentos`) ou clientes.** As tabelas tocadas são exclusivamente:
- `chatbot_conversas` — conversas do robô do WhatsApp (não são acordos)
- `whatsapp_lembretes_log` — log histórico de envios de lembrete (não são acordos)
- `devedores` — apenas VACUUM (recupera espaço em disco, não apaga linhas)
- `user_whatsapp_instances` — apenas VACUUM

A função `cleanup-acordos` (que apaga acordos automaticamente após 30 dias sem pagamento) **fica como está**, conforme sua escolha.

### Etapa 1 — Limpeza de dados antigos (insert tool)

```sql
-- Conversas do chatbot inativas há mais de 30 dias
DELETE FROM chatbot_conversas
WHERE ultimo_webhook_em < now() - interval '30 days'
  AND COALESCE(array_length(mensagens_pendentes, 1), 0) = 0;

-- Logs de lembretes com mais de 60 dias
DELETE FROM whatsapp_lembretes_log
WHERE created_at < now() - interval '60 days';
```

### Etapa 2 — VACUUM FULL (recuperar espaço)

```sql
VACUUM FULL public.chatbot_conversas;
VACUUM FULL public.devedores;
VACUUM FULL public.user_whatsapp_instances;
```

VACUUM **não apaga linhas vivas** — só recupera espaço de tuplas mortas (lixo deixado por updates/deletes anteriores). Acordos e parcelas não são afetados.

### Etapa 3 — Reduzir frequência do cron

Alterar `process-acionamento-agendado-v2` de **cada 5 min → cada 10 min**. Reduz invocações de Edge Function pela metade.

```sql
SELECT cron.unschedule('process-acionamento-agendado-v2-5min');
SELECT cron.schedule(
  'process-acionamento-agendado-v2-10min',
  '*/10 * * * *',
  $$ SELECT net.http_post(...); $$
);
```

### Etapa 4 — Auto-manutenção semanal

Cron novo todo domingo às 04:00 BRT que repete a Etapa 1 automaticamente (só apaga conversas/logs antigos, **nunca acordos**).

```sql
SELECT cron.schedule(
  'weekly-cleanup-logs',
  '0 7 * * 0', -- 04:00 BRT = 07:00 UTC, domingo
  $$
    DELETE FROM chatbot_conversas
    WHERE ultimo_webhook_em < now() - interval '30 days'
      AND COALESCE(array_length(mensagens_pendentes, 1), 0) = 0;
    DELETE FROM whatsapp_lembretes_log
    WHERE created_at < now() - interval '60 days';
  $$
);
```

### Resultado esperado

- Storage: ~750MB → ~150MB
- Invocações Edge Function: −50% no acionamento
- Custo mensal: deve continuar dentro dos $25 grátis
- **Acordos: 100% intocados**

Aprovar para eu rodar as 4 etapas em sequência.

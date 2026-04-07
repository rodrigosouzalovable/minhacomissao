

## Plano: Relatório Diário de Aquecimento via WhatsApp às 20h

### Resumo
Criar uma Edge Function que envia um relatório resumido do aquecimento de todos os números via WhatsApp, agendado para as 20h (BRT), usando a mesma instância e telefone destino configurados no `relatorio_diario_config`.

---

### 1. Nova Edge Function `daily-report-aquecimento`

Seguindo o padrão do `daily-report-whatsapp`:
- Busca config de `relatorio_diario_config` (mesma instância e telefone destino)
- Consulta todas as instâncias de aquecimento ativas
- Para cada número, coleta: fase atual, dias conectado, status postados hoje, contatos salvos hoje, total de interações do dia
- Gera mensagem formatada com seções:

```text
📱 RELATÓRIO DE AQUECIMENTO - 07/04/2026

📊 RESUMO GERAL
• 45 números ativos
• 38 status postados hoje (84%)
• 12 contatos salvos hoje
• 0 alertas críticos

🔥 POR FASE:
• Fase 5 (Aquecidos): 20 números
• Fase 4: 8 números
• Fase 3: 7 números
• Fase 2: 6 números
• Fase 1: 4 números

⚠️ ALERTAS:
• Número X pausado por falhas
• Número Y não postou status (3 dias)

━━━━━━━━━━━━━━━━━━━━
✅ Sistema 100% autônomo
```

### 2. Cron Job (pg_cron)

Agendar via `cron.schedule` para executar às 23:00 UTC (= 20:00 BRT):

```sql
SELECT cron.schedule(
  'daily-report-aquecimento-20h',
  '0 23 * * *',
  $$ SELECT net.http_post(...) $$
);
```

### 3. Config no `supabase/config.toml`

Adicionar bloco `[functions.daily-report-aquecimento]` com `verify_jwt = false`.

### 4. Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/daily-report-aquecimento/index.ts` | Criar (nova Edge Function) |
| `supabase/config.toml` | Adicionar config da função |
| Cron job via SQL insert | Agendar às 23:00 UTC |


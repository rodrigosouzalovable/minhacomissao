

# Relatorios Automatizados para Credores via WhatsApp

## Objetivo

Criar um sistema que envia automaticamente relatorios de KPIs para os credores (Novo Mundo e Grupo Altum) via WhatsApp, sem que eles precisem acessar o dashboard. Os relatorios incluem: valor total recuperado, quantidade de acordos, taxa de inadimplencia por faixa de atraso e comparativo com meses anteriores.

## Arquitetura

O sistema tera uma nova Edge Function que agrega os dados e envia via Z-API (mesma infraestrutura ja usada para lembretes e relatorio diario). Um cron job agendara a execucao semanal (toda segunda-feira as 09:00 BRT) e mensal (dia 1 de cada mes as 09:00 BRT).

## O que sera criado

### 1. Tabela `credor_relatorio_config`

Armazena configuracoes de envio por credor:
- `credor_slug` (text) - identificador do credor
- `telefone` (text) - numero WhatsApp do credor
- `frequencia` (text) - "semanal", "mensal" ou "ambos"
- `ativo` (boolean) - se o envio esta habilitado
- `ultimo_envio_semanal` (timestamptz) - controle de deduplicacao
- `ultimo_envio_mensal` (timestamptz) - controle de deduplicacao

Dados iniciais:
- novomundo: telefone do credorConfig (5562982183144), frequencia "ambos"
- grupoaltum: telefone do credorConfig (5562982183144), frequencia "ambos"

### 2. Edge Function `credor-report-whatsapp`

Responsavel por:
1. Consultar `credor_relatorio_config` para saber quais credores estao ativos
2. Para cada credor, agregar os KPIs:
   - Valor total recuperado (all-time e mes atual)
   - Quantidade de acordos no mes
   - Ticket medio
   - Taxa de conversao
   - **Inadimplencia por faixa de atraso**: parcelas pendentes agrupadas em faixas (1-30 dias, 31-60 dias, 61-90 dias, 90+ dias), com quantidade e valor
   - Comparativo com mes anterior (variacao percentual)
3. Montar mensagem formatada para WhatsApp
4. Enviar via Z-API (mesma integracao existente)
5. Atualizar `ultimo_envio_semanal` ou `ultimo_envio_mensal`

Aceita parametro `tipo` ("semanal" ou "mensal") para diferenciar o conteudo:
- **Semanal**: foco na semana (ultimos 7 dias) + acumulado do mes
- **Mensal**: resumo completo do mes anterior fechado + comparativo

### 3. Cron Jobs (SQL via pg_cron + pg_net)

- **Semanal**: toda segunda-feira as 12:00 UTC (09:00 BRT) chamando a funcao com `tipo=semanal`
- **Mensal**: dia 1 de cada mes as 12:00 UTC (09:00 BRT) chamando a funcao com `tipo=mensal`

### 4. Formato da Mensagem

**Relatorio Semanal:**
```
📊 *RELATORIO SEMANAL - Novo Mundo*
Semana de 17/02 a 23/02/2026

💰 *RECUPERACAO NA SEMANA:*
• Valor recuperado: R$ 45.230,00
• Acordos fechados: 38

📈 *ACUMULADO DO MES:*
• Total recuperado: R$ 150.709,96
• Total de acordos: 422
• Ticket medio: R$ 357,13

⚠️ *INADIMPLENCIA POR FAIXA:*
• 1-30 dias: 45 parcelas (R$ 18.500)
• 31-60 dias: 22 parcelas (R$ 12.300)
• 61-90 dias: 8 parcelas (R$ 5.100)
• 90+ dias: 3 parcelas (R$ 2.800)

📊 vs mes anterior: ↑ 12.3%
```

**Relatorio Mensal:**
```
📊 *RELATORIO MENSAL - Novo Mundo*
Referencia: Janeiro/2026

💰 *RESULTADOS DO MES:*
• Valor total recuperado: R$ 150.709,96
• Acordos fechados: 422
• Ticket medio: R$ 357,13
• Taxa de conversao: 8.2%

⚠️ *INADIMPLENCIA POR FAIXA:*
• 1-30 dias: 45 parcelas (R$ 18.500)
• 31-60 dias: 22 parcelas (R$ 12.300)
• 61-90 dias: 8 parcelas (R$ 5.100)
• 90+ dias: 3 parcelas (R$ 2.800)

📊 *COMPARATIVO:*
• Recuperacao: ↑ 12.3% vs dez/25
• Acordos: ↑ 5.8% vs dez/25
• Ticket medio: ↑ 3.1% vs dez/25

🔗 Dashboard: meusacordos.com.br/credor/novomundo/dashboard?token=nm-dashboard-2026
```

## Detalhes Tecnicos

### Edge Function (`supabase/functions/credor-report-whatsapp/index.ts`)

- Reutiliza a mesma logica de agregacao do `credor-dashboard-data` (consultas a `acordos`, `pagamentos`, `devedores`)
- Adiciona query de inadimplencia: parcelas com `status = 'pendente'` e `data_prevista < CURRENT_DATE`, agrupadas por faixa de dias de atraso
- Usa `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (ja configurados)
- `verify_jwt = false` no config.toml (chamado por cron)

### Tabela e RLS

- RLS habilitado com politica admin-only (mesma padrao das demais tabelas)
- Politica de deny para anonimos

### Cron Jobs

- Dois registros no `cron.schedule` usando `pg_cron` + `pg_net` (mesma abordagem dos lembretes existentes)

## Arquivos a Criar/Modificar

1. **Criar** migration SQL - tabela `credor_relatorio_config` + dados iniciais
2. **Criar** `supabase/functions/credor-report-whatsapp/index.ts`
3. **Editar** `supabase/config.toml` - adicionar `verify_jwt = false`
4. **Executar** SQL para cron jobs (via insert, nao migration)

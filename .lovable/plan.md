

# Plano: Cadência de lembretes para parcelas vencidas (D+1, D+2, D+10, D+11, D+20, D+30)

## Resumo
Substituir o lembrete único de "vencido" por 6 lembretes escalonados nos dias exatos após o vencimento. Cada um com tipo distinto para deduplicação automática.

## Alterações em `supabase/functions/check-payment-reminders/index.ts`

### 1. Remover a query genérica de "parcelas vencidas"
A query atual busca todas as parcelas com `data_prevista < hoje` nos últimos 30 dias e marca como tipo `'vencido'`. Isso será substituído.

### 2. Calcular as 6 datas-alvo e buscar parcelas específicas
Em vez de buscar um range, calcular exatamente quais datas de vencimento correspondem a D+1, D+2, D+10, D+11, D+20 e D+30 a partir de hoje:

```text
Hoje = 2026-03-13
D+1  → parcelas com vencimento em 2026-03-12 (ontem)
D+2  → parcelas com vencimento em 2026-03-11
D+10 → parcelas com vencimento em 2026-03-03
D+11 → parcelas com vencimento em 2026-03-02
D+20 → parcelas com vencimento em 2026-02-21
D+30 → parcelas com vencimento em 2026-02-11
```

Buscar parcelas pendentes cuja `data_prevista` seja exatamente uma dessas 6 datas.

### 3. Tipos de lembrete distintos
Cada dia gera um tipo único: `'vencido_d1'`, `'vencido_d2'`, `'vencido_d10'`, `'vencido_d11'`, `'vencido_d20'`, `'vencido_d30'`. A deduplicação existente (por `pagamento_id` + `tipo_lembrete` na fila e no log) impede reenvio.

### 4. Mensagens diferenciadas por estágio
- **D+1 e D+2**: Tom amigável — "sua parcela venceu ontem/anteontem, caso já tenha pago envie o comprovante"
- **D+10 e D+11**: Tom mais firme — "identificamos que a parcela continua em aberto há X dias"
- **D+20**: Alerta — "parcela em atraso há 20 dias, regularize para evitar problemas"
- **D+30**: Último aviso — "último aviso antes de medidas administrativas"

### 5. Manter D-3 e D+0 inalterados
As queries de parcelas futuras (3 dias antes) e dia do vencimento continuam como estão.

## Sem alterações no banco de dados
Os novos tipos (`vencido_d1`, etc.) são apenas strings na coluna `tipo_lembrete` — não precisa de migration.


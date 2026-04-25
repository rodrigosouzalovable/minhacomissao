## Diagnóstico

Investiguei tudo. **A função de aquecimento funciona perfeitamente** — disparei manualmente agora e ela já iniciou 2 conversas em segundos (logs confirmam). O problema é só com o **agendamento**:

### Problemas encontrados

1. **Cron novo nunca executou** (`aquecimento-auto-diario`, jobid 28, schedule `*/30 7-23 * * *`): foi criado na migração anterior mas tem **0 execuções até agora**. O próximo slot natural é 15:00 UTC.

2. **Janela de horário do cron está errada** (UTC × BRT):
   - pg_cron interpreta `7-23` como **UTC**
   - `7-23 UTC` = **4h-20h BRT**
   - Mas a função só aceita execuções entre **7h-21h BRT** (10h-00h UTC)
   - Resultado: cron dispara das 4h-7h BRT (recusado pela função) e **NÃO dispara das 20h-21h BRT** (perda de janela)

3. **Sábado tem fator 0.6** — ok, mantemos (anti-ban no fim de semana). Mínimo de 1 conversa/dia já está garantido.

### Por que parecia "parado"

- Último ciclo automático que rodou hoje foi às **11:00 BRT** (do cron antigo de hora em hora, antes da troca)
- O cron novo `*/30 7-23 UTC` simplesmente **não disparou ainda** (foi criado no meio do intervalo)
- Sem cron disparando, nenhuma conversa nova entre 11h e agora (~12h BRT)

---

## Correções

### 1. Reagendar cron com janela correta (BRT)

Substituir `*/30 7-23 * * *` por **`*/30 10-23,0 * * *`** (cobre 7h-21h BRT exatamente, alinhado com a regra da função).

```sql
SELECT cron.unschedule('aquecimento-auto-diario');
SELECT cron.schedule('aquecimento-auto-diario', '*/30 10-23,0 * * *', $$ ... $$);
```

### 2. Disparar 1 ciclo manual imediatamente

Já fiz agora via teste — 2 conversas em curso. Vou disparar mais 1 explicitamente após o ajuste para "destravar" a fila e popular o Inbox.

### 3. Validação

Após o fix, em ~30 minutos o próximo cron dispara e processa 12 pares. Em 1h teremos ~24 instâncias novas conversando. Em 4h, todas as ~155 instâncias já terão sido tocadas pelo menos 1×.

---

## Arquivos afetados

- **SQL** (executado via insert tool, contém anon key — não vai pra migração):
  - `cron.unschedule('aquecimento-auto-diario')`
  - `cron.schedule(...)` com `*/30 10-23,0 * * *`
- **Disparo manual** de `whatsapp-aquecimento` para iniciar conversas agora.

**Sem alteração de código** — apenas correção do agendamento.

## Custo Lovable Cloud

Sem mudança em relação ao plano anterior (já contava com ~28 ciclos/dia). Mantém estimativa de +3-5% no consumo mensal.


## Nova Estrategia de Aquecimento — 1 conversa/dia, espalhada aleatoriamente

### Situacao atual
- Cron roda a cada **1 hora** (14 execucoes/dia)
- Cada execucao tenta processar **todos os pares de uma vez** (~32 pares com 64 instancias)
- Target: **15 mensagens/dia** por instancia
- Resultado: rajada de 30+ conversas simultaneas — comportamento nao natural

### Nova estrategia

Cada instancia conversa **apenas 1 vez por dia**, e os pares sao processados **um de cada vez**, espalhados ao longo do dia de forma aleatoria.

```text
Antes:  10h → [30 pares de uma vez] → 11h → [30 pares] → ...
Depois: 10h → [2 pares] → 11h → [skip] → 12h → [3 pares] → 13h → [1 par] → ...
```

### Como funciona

1. **TARGET_MESSAGES_PER_DAY = 1** (era 15)
   - Cada instancia conversa com apenas 1 parceiro por dia

2. **Maximo 3 pares por execucao do cron**
   - A cada hora, processa no maximo 3 pares aleatorios
   - 64 instancias = 32 pares, distribuidos ao longo de ~14 horas
   - Media: 2-3 pares/hora, naturalmente espalhados

3. **Skip aleatorio** (50% de chance de pular a hora)
   - Cada execucao tem 50% de chance de nao fazer nada
   - Torna o padrao ainda mais imprevisivel e natural
   - Resultado efetivo: ~7 execucoes reais/dia, ~4-5 pares cada

4. **Delay aleatorio entre pares** (30s a 120s)
   - Quando processa 2-3 pares na mesma hora, espera 30-120s entre cada um
   - Nao envia tudo junto

### Impacto no consumo Lovable Cloud
- **Cron continua horario** (14 invocacoes/dia) — sem aumento
- **Metade das invocacoes faz skip rapido** — reduz processamento
- **Elimina ~90% das chamadas ao whatsapp-ia-responder** (de ~30/hora para ~3/hora)
- **Economia liquida significativa** em relacao ao modelo atual

### Alteracoes

#### 1. Edge Function `whatsapp-aquecimento/index.ts`
- TARGET_MESSAGES_PER_DAY: 15 → 1
- Adicionar MAX_PAIRS_PER_CYCLE = 3
- Adicionar skip aleatorio (50% chance)
- Aumentar delay entre pares para 30-120s
- Manter toda logica de auto-enrollment, reativacao e manual-test intacta

#### 2. Nenhuma mudanca no cron
- Mantem `0 10-23 * * *` (horario, 14x/dia)
- O skip aleatorio dentro da function cuida da distribuicao

### Arquivo
1. **`supabase/functions/whatsapp-aquecimento/index.ts`** — target=1, max 3 pares/ciclo, skip aleatorio


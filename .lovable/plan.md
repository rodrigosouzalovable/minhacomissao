

## Gravar preferência de economia + Otimizar consumo do Aquecimento

### Preferência a gravar
Salvar em memória: **"Sempre avisar o usuário antes de qualquer mudança que aumente o consumo da Lovable Cloud (Edge Functions, banco de dados, storage). Priorizar economia."**

### Diagnóstico de consumo atual

O aquecimento é o maior consumidor:
- **Cron a cada 15 min** = ~56 execuções/dia da edge function `whatsapp-aquecimento`
- Cada execução faz health checks (fetch externo) em até 30 instâncias
- Cada par gera uma chamada extra ao `whatsapp-ia-responder`
- Com 77 instâncias e 15 msgs/dia/instância, o target é atingido em poucas rodadas

### Otimização proposta

1. **Reduzir frequência do cron de 15 min para 60 min**
   - De ~56 para ~14 execuções/dia (75% de redução)
   - 15 msgs/dia ainda são facilmente atingidas com 14 ciclos
   - Alterar via SQL: `cron.alter_job` para `0 10-23 * * *`

2. **Skip rápido quando target atingido**
   - Se todas as instâncias já atingiram 15 msgs/dia, retornar imediatamente sem fazer health checks
   - Evita chamadas de rede desnecessárias

3. **Reduzir health checks desnecessários**
   - Só fazer health check em instâncias que vão efetivamente enviar neste ciclo
   - Se uma instância já atingiu o limite diário, não verificar saúde dela

### Arquivos
1. **`mem://preferences/cloud-cost-awareness`** — gravar preferência
2. **`supabase/functions/whatsapp-aquecimento/index.ts`** — skip rápido + health check seletivo
3. **Cron job** — alterar frequência de 15 min para 60 min

### Impacto
- Redução de ~75% nas execuções diárias do aquecimento
- Mesma funcionalidade (15 msgs/dia por instância mantidas)
- Economia significativa em Edge Function invocations


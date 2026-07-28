## Problema

Ao iniciar uma nova campanha em modo rajada, o worker `envio-meta-massa-burst` verifica o campo `rate_limit_ate` da instância em `meta_whatsapp_instances`. Se uma campanha anterior deixou esse timestamp gravado no futuro (a Meta responde `Retry-After` de até vários minutos após rate limit), o worker atualiza `proximo_em` para esse mesmo instante e agenda um `selfInvoke` para daqui a X segundos — sem enviar nenhuma mensagem. É por isso que a campanha CSIM 14 mostra "Rodando" com 0/671 e "Próximo envio em 572s".

Ou seja: o atraso não é da nova campanha, é herança de uma pausa por rate limit de uma execução anterior naquelas mesmas instâncias.

## Correção

Ao iniciar uma nova campanha, limpar a pausa residual das instâncias selecionadas para que os workers comecem a enviar imediatamente.

### Alterações

1. `supabase/functions/envio-meta-massa-iniciar/index.ts`
   - Antes de disparar os workers de rajada, executar um `update` em `meta_whatsapp_instances` para as instâncias selecionadas:
     - `rate_limit_ate = null`
     - `rajada_taxa_atual = null` (força a rampa a começar a partir do teto configurado no slider, sem herdar taxa cortada)
   - Não mexer em `pausa_automatica_ate` quando o motivo começar com `status=` (BANNED/FLAGGED/RESTRICTED) — essa é uma pausa legítima da Meta que deve permanecer.

2. `supabase/functions/envio-meta-massa-burst/index.ts`
   - Reduzir o teto máximo de espera por rate limit residual detectado no início do worker: se o `rate_limit_ate` for maior que 60s à frente, tratar como órfão e limpar (em vez de esperar até 5 min). O código já limpa acima de 5 min; abaixar para 60s garante que rate limits antigos nunca travem uma campanha nova.

Depois dessas mudanças, clicar em "Enviar" começa a disparar dentro de 1-2 segundos, e o "Próximo envio em Xs" só aparece quando o rate limit for gerado pela campanha atual.

### Fora do escopo

Não altero a lógica de pausa por BANNED/FLAGGED/RESTRICTED, nem os limites do slider msgs/s, nem o algoritmo AIMD durante a campanha.

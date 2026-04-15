

## Corrigir Aquecimento Automático — Todas as Instâncias Travadas em PAUSADO

### Diagnóstico

O cron está rodando corretamente (`*/15 10-23 * * *`, 7h-20h BRT). O problema é que **todas as 77 instâncias estão PAUSADO** e o health check falha para todas, impedindo a reativação. O ciclo aborta com "Menos de 2 instâncias ativas."

**Por que o manual funciona mas o automático não?**
O teste manual pula o health check e envia direto. O automático exige que o health check retorne `connected: true`, `status: "CONNECTED"` ou `state: "open"` — mas a UAZAPI pode retornar em outro formato (ex: `{ instance: { state: "open" } }` ou `{ status: "open" }`).

O ciclo de 77 instâncias com health check sequencial de 8s timeout também pode exceder o limite de execução da edge function (max 26-60s).

### Correções

#### 1. Tornar o health check mais resiliente (`whatsapp-aquecimento`)
- Aceitar mais formatos de resposta da UAZAPI (`instance.state`, `status: "open"`, etc.)
- Adicionar log detalhado da resposta para debug
- Reduzir timeout de 8s para 5s

#### 2. Limitar health checks para não estourar timeout
- Fazer health check em paralelo (Promise.allSettled) com limite de 10 simultâneos
- Limitar a 30 instâncias por ciclo para não estourar o tempo da function

#### 3. Reativar em massa instâncias `ativo: true`
- Nova lógica: se a instância principal está `ativo: true` na tabela `user_whatsapp_instances`, reativar automaticamente para `EM_AQUECIMENTO` SEM exigir health check
- O health check passa a ser feito apenas NO MOMENTO do envio — se falhar, pausa novamente
- Isso garante que instâncias conectadas não fiquem presas em PAUSADO

#### 4. Adicionar logging detalhado
- Logar quantas instâncias foram reativadas, quantas falharam health check, e o motivo
- Logar a resposta exata do `/instance/status` para diagnóstico

### Arquivos
1. **`supabase/functions/whatsapp-aquecimento/index.ts`** — health check resiliente, reativação automática, logging

### Resultado
Instâncias ativas serão automaticamente reativadas a cada ciclo. O aquecimento começará a funcionar de forma autônoma às 7h BRT diariamente.


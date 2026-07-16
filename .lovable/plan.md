# Envio Meta — Filtro de Qualidade, Auto-Exclusão em Erro e Round-Robin Estrito

Ajustar o fluxo de disparo em massa da aba **Envio Meta** para:

1. **Excluir automaticamente instâncias RED/YELLOW** antes de iniciar o job.
2. **Remover instância da fila no primeiro erro** (não mais após 2 falhas consecutivas).
3. **Enviar exatamente 1 mensagem por ciclo de delay**, alternando entre as instâncias em **round-robin estrito** (nunca duas mensagens no mesmo segundo, nunca em rajada).

---

## 1. Frontend — `src/pages/EnvioMeta.tsx`

Quando o usuário clica em **"Selecionar todas"** e depois em **Disparar**:

- Antes de chamar `envio-meta-massa-iniciar`, filtrar `instanciaIds` removendo qualquer instância cuja `saude_quality` seja `RED` ou `YELLOW`.
- Se sobrar zero instâncias, mostrar toast de erro (`"Nenhuma instância com qualidade GREEN/UNKNOWN disponível"`) e abortar.
- Mostrar toast informativo listando quantas foram descartadas: `"X instância(s) RED/YELLOW removidas do disparo automaticamente"`.
- No painel "Instâncias selecionadas", marcar visualmente RED/YELLOW como desabilitadas (checkbox travada + tooltip explicando).

## 2. Backend — `supabase/functions/envio-meta-massa-iniciar/index.ts`

- Após validar `instanciaIds`, consultar `meta_whatsapp_instances` e filtrar novamente RED/YELLOW no servidor (defesa em profundidade).
- Persistir apenas as instâncias válidas em `envio_meta_job.instancia_ids`.
- Se todas forem excluídas → retornar erro claro sem criar job.

## 3. Backend — `supabase/functions/envio-meta-massa-tick/index.ts`

### 3a. Auto-exclusão no primeiro erro

- Reduzir `MAX_FALHAS_CONSECUTIVAS` de `2` para `1`.
- Qualquer resposta com `success:false` de `send-whatsapp-meta` (que não seja `tier_full`/`pool_blocked`/`pool_paused`/`blocked`) marca a instância imediatamente em `instancias_bloqueadas_run` e reenfileira o item para outra instância tentar.
- Se todas as instâncias forem bloqueadas → encerra o job com motivo detalhado (comportamento já existente).

### 3b. Round-robin estrito (1 mensagem por delay)

Hoje `pick-meta-instance` escolhe por score `1/(1+uso)`, o que aproxima round-robin mas não garante alternância. Ajuste:

- Adicionar campo `ultima_instancia_id` em `envio_meta_job` (via migration).
- No tick, ao chamar `pick-meta-instance`, passar `ultima_instancia_id` como `excluir_id`.
- Em `pick-meta-instance`, se `excluir_id` for informado e houver ao menos 2 candidatos, remover essa instância dos candidatos → força alternância.
- Após envio bem-sucedido, gravar `ultima_instancia_id = instId` no job.
- Delay já é aplicado ANTES do próximo item via `proximo_em` + `sleep(r.delayMs)` no loop; garantir que `processarItem` respeita `proxMs > 0` (já respeita). Sem paralelismo — o loop é estritamente sequencial dentro do tick, e o cron não dispara concorrência porque o self-invoke usa `proximo_em`.

### 3c. Garantia de "nunca no mesmo segundo"

- Impor `delayMs = Math.max(delayMs, 1000)` (já é ≥1s pelo `min_seg`). Adicionar sanity check: se `Date.now() - ultimoEnvioMs < 1000`, aguardar o restante antes do próximo envio (proteção contra edge cases de reprocessamento).

## 4. Migration

```sql
ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS ultima_instancia_id uuid;
```

Sem novos índices — coluna é apenas leitura/escrita por job.

## 5. Fora de escopo

- Não alterar `send-whatsapp-meta` nem lógica de custo/billing.
- Não mexer em campanhas agendadas (`process-campanha-meta-diaria`) — o pedido é apenas para o disparo manual da aba Envio Meta.
- Sem novos crons, sem novos polling, sem Realtime adicional (respeita alerta de custo Lovable Cloud).

## 6. Verificação

- Após implementar, disparar teste com 3 instâncias (1 RED, 2 GREEN) e 6 contatos:
  - RED some da fila no início.
  - Msgs alternam A→B→A→B com delays randômicos ≥ `min_seg`.
  - Se B der erro no 1º envio, B some da fila e A recebe os próximos.

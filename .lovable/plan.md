# Corrigir cota da BM: 1000 em vez de 2000

## O que está acontecendo (verificado no banco)

- A BM **Facebook Edna** está com `tier_diario = 1000` (valor padrão criado na migração). As três BMs estão com 1000.
- Os WhatsApps dessa BM estão com `TIER_2K` no campo de limite da instância (`messaging_limit_manual`).
- A cota da BM (`meta_bm_uso_24h`) lê **somente** o campo da BM. Como o tier que você definiu foi no card do WhatsApp, ele nunca chegou à BM — daí "1000 restantes" mesmo sem disparo nenhum nas últimas 24h.

O "0/1000 da BM em 24h" mostrado no print confirma: uso está zerado (correto), o limite é que está errado.

## Correção proposta

1. A cota da BM passa a usar o **maior tier entre os WhatsApps vinculados** quando a BM não tiver um limite definido manualmente. Assim, definir TIER_2K nos números da Facebook Edna resulta em 2.000/24h automaticamente, e TIER_10K nos números da BM Rodrigo resulta em 10.000.
2. Definir o tier no card do WhatsApp passa a **sincronizar** o limite da BM correspondente (o maior tier entre os números daquela BM), para que Oficial Meta, Envio Meta e o backend mostrem o mesmo número.
3. Quando você editar o tier direto na BM (campo "Definir tier"), esse valor manual **prevalece** sobre o cálculo automático.
4. Ajuste imediato dos dados: Facebook Edna → 2.000; BM Rodrigo Ribeiro (Facebook Avatus) → 10.000; FB 17 → 250 (conforme os tiers atuais das instâncias).

Depois disso, em Envio Meta os cards da Facebook Edna devem mostrar "2000 restantes (BM)" e "0/2000 da BM em 24h".

## Detalhes técnicos

- Nova coluna `tier_manual` (boolean, default false) em `meta_business_managers` para marcar quando o admin fixou o tier na própria BM.
- `meta_bm_uso_24h()` reescrita: `limite = CASE WHEN tier_ilimitado THEN ilimitado WHEN tier_manual THEN tier_diario ELSE COALESCE(max(tier das instâncias), tier_diario) END`, com mapeamento TIER_250=250, TIER_1K=1000, TIER_2K=2000, TIER_10K=10000, TIER_100K=100000, UNLIMITED=ilimitado, usando `COALESCE(messaging_limit_manual, saude_tier)`.
- Retorno da função ganha o limite efetivo já resolvido, então `useBmCotas`, `EnvioMeta.tsx`, `ConfigurarMeta.tsx`, `BusinessManagersManager.tsx` e `_shared/bm-cotas.ts` seguem funcionando sem mudar a leitura (`tier_diario` passa a vir com o valor efetivo).
- `BusinessManagersManager.tsx`: salvar tier na BM grava `tier_manual = true`; nova opção "Automático (pelo tier dos WhatsApps)" que volta `tier_manual = false`.
- Nenhum cron, polling ou Realtime novo. A consulta agregada continua a mesma, só ganha um join com as instâncias (já indexado por `meta_bm_id`) — impacto de custo desprezível.

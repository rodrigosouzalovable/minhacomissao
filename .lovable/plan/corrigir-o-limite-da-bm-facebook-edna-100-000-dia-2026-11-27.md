# Corrigir o limite da BM "Facebook Edna" (100.000/dia)

## O que foi encontrado
- A escolha "TIER_100K" foi gravada nos 21 números da BM Facebook Edna, mas só como rótulo.
- O valor numérico usado nas contas continuou antigo: a BM está travada em 10.000/dia (limite manual da BM) e os números seguem com 10.000, 2.000 ou 1.000.
- Por isso o painel "Limite combinado" (130.000) não mudou, e os disparos também continuam limitados aos valores antigos.

## Correção
1. Ao trocar o limite num número vinculado a uma BM, gravar também o valor numérico (ex.: 100.000) em todos os números dessa BM e na própria BM (limite manual da BM passa a ser o escolhido; "Automático" devolve a BM ao cálculo automático).
2. Ajustar agora os dados da Facebook Edna: BM em 100.000/dia e os 21 números com 100.000/dia.
3. Conferir que o painel passa a mostrar o novo limite combinado (aprox. 220.000).

## Detalhes técnicos
- `propagarTierBm` em `src/pages/ConfigurarMeta.tsx` atualiza só `messaging_limit_manual`/`messaging_limit_source`; passará a incluir `tier_diario = BM_TIER_VALUES[valor]` e a atualizar `meta_business_managers` (`tier_diario`, `tier_manual=true`, `tier_ilimitado` para TIER_UNLIMITED; em `__auto__`, `tier_manual=false`).
- `resolveBmTier` dá prioridade a `bm.tier_manual`, por isso a BM com 10.000 manual sobrepunha o novo valor.
- Correção de dados: UPDATE em `meta_business_managers` (id 328a6225…) e `meta_whatsapp_instances` com `meta_bm_id` dessa BM.
- Teste pequeno em `src/lib` para o valor numérico gravado a partir do tier escolhido.
- Sem custo extra de Cloud (nenhum cron, polling ou consulta nova).

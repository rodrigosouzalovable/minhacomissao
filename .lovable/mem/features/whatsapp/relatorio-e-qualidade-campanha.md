---
name: Relatório aquecimento só números próprios + saída YELLOW/RED da campanha
description: Relatório 12h/18h lista só provider=meta sem parceiros; queda para YELLOW/RED retira o número da campanha em andamento e "Selecionar todas" marca só GREEN
type: feature
---

- `meta-aquecimento-relatorio` (12h e 18h) só considera instâncias `provider='meta'` e que NÃO estão em `meta_instance_parceiros`. Espelhos UAZAPI e números de parceiros ficam fora.
- Em `envio-meta-massa-tick`, antes de cada pick, a saúde das instâncias do job é reverificada (no máximo 1x a cada 5 min por job) e qualquer número em YELLOW/RED entra em `instancias_bloqueadas_run`, saindo da campanha em andamento, com aviso WhatsApp ao admin (`envio_meta_qualidade_saiu`, uma vez por job+instância).
- Em `check-meta-instance-health`, quarentena/saída do pool por queda de qualidade vale mesmo com `liberar_qualidade_global = true`; só `qualidade_liberada_manual` (por número) isenta. A chave global continua liberando seleção/envio manual.
- Em `EnvioMeta.tsx`, "Selecionar todas (GREEN)" marca apenas CONNECTED + nome não REJECTED + BM com saldo + `saude_quality === 'GREEN'`. YELLOW/RED/UNKNOWN só manualmente.

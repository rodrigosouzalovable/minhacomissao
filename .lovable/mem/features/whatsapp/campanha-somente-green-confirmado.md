---
name: Campanha só com GREEN confirmado
description: Campanha/disparo em massa Meta exige saude_quality GREEN com leitura da Meta bem-sucedida e menos de 6h; liberar_qualidade_global vale só para aquecimento
type: feature
---

Regra: campanha e disparo em massa (API oficial Meta) só usam instâncias com
`saude_quality = 'GREEN'`, `qualidade_leitura_ok = true` e `saude_checked_at`
com menos de 6 horas. YELLOW, RED, UNKNOWN, qualidade nula e leitura falhada
(token inválido) são sempre recusados, com motivo por instância.

- `liberar_qualidade_global` e `qualidade_liberada_manual` valem **apenas** para
  aquecimento/recuperação. `pick-meta-instance` recebe `contexto: 'campanha' | 'aquecimento'`
  (default = campanha).
- `check-meta-instance-health` lê a qualidade em duas fontes (número e
  `/{waba_id}/phone_numbers`) e consolida pelo **pior** valor; grava
  `qualidade_leitura_ok` / `qualidade_leitura_erro`.
- UI (PoolMetaPanel): badges `GREEN` / `SEM LEITURA` / `DESATUALIZADA` +
  aviso de números fora de campanha.

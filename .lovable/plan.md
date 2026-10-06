# Tier da instância replica para toda a BM

Ao alterar o "Limite de mensagens" no card de uma instância vinculada a uma BM, todas as instâncias da mesma BM recebem o mesmo tier automaticamente.

## Comportamento

- Escolher um tier (250, 1K, 2K, 10K, 100K, Ilimitado) numa instância com BM: o mesmo valor é gravado em todas as instâncias dessa BM, e a cota da BM passa a mostrar esse limite.
- Escolher "Automático": todas as instâncias da BM voltam para o automático (cada uma usa o tier vindo da Meta).
- Antes de salvar, um aviso confirma: "Isso vai alterar o tier de N instâncias da BM X". Ao concluir: "Tier 2K aplicado a N instâncias da BM X".
- Instância sem BM: continua alterando só ela.
- Vale também para o diálogo "Editar instância" quando o limite for alterado ali.

## Detalhes técnicos

- `src/pages/ConfigurarMeta.tsx`, função `salvarTierManual`: se `inst.meta_bm_id` existir, aplicar o update com `.eq("meta_bm_id", inst.meta_bm_id)` em vez de `.eq("id", inst.id)`. No modo automático, `messaging_limit_source` = `meta_api`/`default` por instância (dois updates: com e sem `saude_tier`).
- Mesmo tratamento em `salvarEdicao()` quando `messaging_limit_manual` mudar.
- RLS atual já restringe às instâncias que o usuário pode editar (parceiro só altera as dele).
- A função `meta_bm_uso_24h` já usa o maior tier das instâncias quando a BM não tem tier manual, então a cota reflete na hora. Sem migração, sem nova edge function, sem custo extra no Cloud.

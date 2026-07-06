## Causa

O painel **Envio Meta Massa** carrega as instâncias direto da tabela `meta_whatsapp_instances` (linha 289 de `src/pages/EnvioMeta.tsx`), lendo a coluna `tier_diario` bruta — que está fixa em 250 no banco. A migração anterior corrigiu a RPC `meta_envios_resumo`, mas essa RPC não é usada aqui, então o card continua mostrando 250.

Confirmado no banco: `LD 18` tem `tier_diario=250` e `messaging_limit_manual=TIER_2K`.

## Correção

Calcular o tier efetivo no próprio frontend, ao carregar as instâncias, usando a mesma precedência da aba API Oficial Meta: `messaging_limit_manual` > `saude_tier` > fallback do `tier_diario` da tabela.

### Mudanças em `src/pages/EnvioMeta.tsx`

1. Adicionar helper local `tierParaNumero(tag)`:
   - `TIER_UNLIMITED`/`100K` → 100000
   - `10K` → 10000, `2K` → 2000, `1K` → 1000, `250` → 250, `50` → 50
2. Após o `supabase.from("meta_whatsapp_instances").select("*")`, mapear cada instância substituindo `tier_diario` pelo valor derivado de `messaging_limit_manual || saude_tier`, mantendo o valor da coluna como fallback.
3. Nenhuma mudança visual: os elementos que já usam `i.tier_diario` (linhas 805, 860, 861) passam a mostrar o número correto (ex.: `10/2000 hoje`, `1990 restantes`).

Sem migration, sem alterações em outras abas.
## Problema

Na aba **Envio Meta Massa** cada instância mostra "0/250 hoje" e "250 restantes" mesmo depois de você configurar TIER_2K (2.000/dia) na aba **API Oficial Meta**. Isso acontece porque o painel lê a coluna `tier_diario` da tabela `meta_whatsapp_instances`, que é um campo antigo/independente e não é atualizado quando você troca o tier na outra aba (que grava em `messaging_limit_manual` / `messaging_limit_source` ou é sincronizado da Meta em `saude_tier`).

## Solução

Fazer o "limite diário" do Envio Meta Massa refletir automaticamente o tier efetivo configurado — sem duplicar dado nem exigir sincronização manual.

### Passo único: atualizar a RPC `meta_envios_resumo`

Alterar a função para calcular `tier_diario` on the fly a partir do tier efetivo de cada instância, na seguinte ordem de precedência:

1. `messaging_limit_manual` (override manual definido em API Oficial Meta)
2. `saude_tier` (sincronizado automaticamente da Graph API Meta)
3. Fallback `TIER_250`

Mapeamento tag → número diário:

```text
TIER_50        →      50
TIER_250       →     250
TIER_1K        →   1.000
TIER_2K        →   2.000
TIER_10K       →  10.000
TIER_100K      → 100.000
TIER_UNLIMITED → 100.000 (teto exibido)
```

A função aceita as tags com ou sem o prefixo `MESSAGING_LIMIT_` retornado pela Graph API (ex.: `MESSAGING_LIMIT_TIER_2K`).

### Efeito no frontend

Nenhuma mudança de código no `EnvioMeta.tsx` é necessária: ele já lê `i.tier_diario` do resumo. Ao trocar o tier em **API Oficial Meta** (manual ou via botão "Sincronizar agora"), o card de Envio Meta Massa passa a mostrar imediatamente o novo limite (ex.: "13/2000 hoje", "1987 restantes") no próximo refetch (30s) ou ao recarregar a aba.

## Detalhe técnico

Migration única substituindo `public.meta_envios_resumo(uuid, date)`. O bloco alterado é o `SELECT ... FROM public.meta_whatsapp_instances i` dentro do agregado `v_por_instancia`, trocando `i.tier_diario` por uma expressão `CASE` que resolve o tier efetivo. O restante da função (unicos, série 7d, envios) permanece idêntico. A coluna `tier_diario` da tabela não é removida — apenas deixa de ser a fonte usada pelo painel.
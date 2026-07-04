
# Sync de Limite de Mensagens por Número (Meta Graph API + Fallback Manual)

## Objetivo
Buscar automaticamente `messaging_limit_tier` de cada número na Graph API da Meta e usar esse valor para dimensionar a cota diária no pool. Enquanto a permissão `whatsapp_business_management` não é aprovada, permitir configuração manual por número que serve de fallback.

## Comportamento

- **Cota diária efetiva** por número = `min(fase_rampup_quota, tier_quota_efetivo)`
- **tier_quota_efetivo** = valor sincronizado da Meta se disponível, senão valor manual, senão TIER_1K (1000).
- Sync roda a cada 2h dentro do `check-meta-instance-health` (já existente).
- Cada card em `PoolMetaPanel` mostra: tier atual, origem (🔄 auto / ✋ manual), última sincronização.

## Mudanças Técnicas

### 1. Migration
Adicionar em `meta_whatsapp_instances`:
- `messaging_limit_tier text` — valor bruto da Meta (`TIER_250`, `TIER_1K`, `TIER_2K` [não oficial mas usaremos como intermediário], `TIER_10K`, `TIER_100K`, `TIER_UNLIMITED`)
- `messaging_limit_manual text nullable` — override manual do usuário
- `messaging_limit_source text` — `'meta_api' | 'manual' | 'default'`
- `messaging_limit_synced_at timestamptz`
- `throughput_level text` — `STANDARD` ou `HIGH` (informativo)

Função helper `get_effective_daily_quota(instance_id uuid)` que retorna o número final considerando ramp-up + tier.

### 2. Edge Function `check-meta-instance-health`
Estender o fetch atual:
```
GET /{phone_number_id}?fields=quality_rating,messaging_limit_tier,throughput,name_status
```
- Se retorna `messaging_limit_tier` com sucesso → salva em `messaging_limit_tier`, source=`meta_api`.
- Se retorna erro de permissão (permissão ainda não aprovada) → mantém source atual, não sobrescreve manual.
- Sempre atualiza `messaging_limit_synced_at`.

### 3. Edge Function `pick-meta-instance`
Substituir uso de cota fixa por `get_effective_daily_quota()`. Score continua igual, só a divisão `usage/quota` passa a usar o valor dinâmico.

### 4. Frontend

**`ConfigurarMeta.tsx` — aba "API Oficial Meta"**
Em cada linha de número, adicionar:
- Badge do tier atual + fonte (auto/manual)
- Select para override manual: `TIER_250 (250) | TIER_1K (1000) | TIER_2K (2000) | TIER_10K (10000) | TIER_100K (100000) | Ilimitado`
- Botão "Limpar override" que zera o manual (volta a usar auto/default)
- Botão "Sincronizar agora" (chama `check-meta-instance-health` para o número)

**`PoolMetaPanel.tsx`**
- Badge do tier ao lado da quality (ex: `🟢 GREEN · TIER_2K · 400/dia`)
- Tooltip mostrando: cota tier, cota fase ramp-up, cota efetiva usada
- Ícone 🔄 se source=meta_api, ✋ se manual

### 5. Aviso quando permissão sair
Quando a primeira sincronização automática for bem-sucedida, notificar admin via WA que o sync está ativo e listar tiers reais detectados vs. manuais.

## Ordem de Execução
1. Migration (colunas + função helper).
2. Estender `check-meta-instance-health` com fetch de tier.
3. Atualizar `pick-meta-instance` para usar `get_effective_daily_quota`.
4. UI em `ConfigurarMeta.tsx` (select manual + botão sync).
5. Badges em `PoolMetaPanel.tsx`.
6. Preencher manual dos 20 números atuais (você faz pela UI).

## Fora do Escopo
- Solicitar/renovar permissões da Meta (usuário faz no Business Manager).
- Alterar limites globais do pool (delays/horários).
- Ramp-up já implementado, não muda.

## Notas Técnicas
- Meta oficialmente lista `TIER_250/1K/10K/100K/UNLIMITED`. Alguns painéis mostram `2K` como estado intermediário — trataremos como valor manual `2000` sem depender da API. Se a API devolver algo desconhecido, salvamos raw e usamos fallback TIER_1K.
- Sem permissão `whatsapp_business_management`, o fetch de `messaging_limit_tier` retorna erro OAuth — capturado e ignorado, mantém fonte anterior.
- Nenhuma quebra de compat: se colunas novas ficarem nulas, sistema cai no default TIER_1K = 1000.

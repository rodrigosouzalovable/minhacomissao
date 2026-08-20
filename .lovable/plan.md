# Vincular BM e definir Tier já na criação da instância

Hoje o diálogo "Nova instância Meta WhatsApp" só tem um campo de texto "Business Manager ID (opcional)" e um "Tier diário inicial" numérico. A vinculação real com a BM cadastrada e o "Limite de mensagens" só existem depois, dentro do card da instância.

## O que muda no diálogo "Nova instância"

1. O campo de texto "Business Manager ID" é substituído por um seletor **Business Manager**, com a mesma lista usada no card (BMs cadastradas, com estrela na padrão e o Business ID entre parênteses) e a opção "— Não vinculada —".
   - Abaixo, o mesmo aviso do card: "O limite diário de disparos é definido na BM e compartilhado por todos os WhatsApps vinculados a ela."
   - Se nenhuma BM estiver cadastrada, aparece o aviso para cadastrar em "Business Managers".
   - Ao escolher a BM, o Business ID dela é gravado junto, então nada se perde em relação ao campo antigo.
2. O campo numérico "Tier diário inicial" é substituído pelo seletor **Limite de mensagens**, idêntico ao do card: Automático (padrão TIER_1K), TIER_250, TIER_1K, TIER_2K, TIER_10K, TIER_100K e Ilimitado.
3. Ao salvar, a nova instância já nasce com a BM vinculada e o limite escolhido — sem precisar reabrir o card para ajustar.

O mesmo par de campos passa a valer também no diálogo "Editar instância", para manter as duas telas coerentes.

## Detalhes técnicos

- Arquivo único: `src/pages/ConfigurarMeta.tsx`.
- Estados `form` e `editForm`: trocar `business_id`/`tier_diario` (string numérica) por `meta_bm_id: string` (com sentinela `"__none__"`) e `messaging_limit_manual: string` (com sentinela `"__auto__"`).
- Em `adicionar()`: gravar `meta_bm_id` (null quando `__none__`), `business_id` derivado do `business_id` da BM selecionada, `messaging_limit_manual` (null quando automático), `messaging_limit_source` = `manual`/`padrao` e `tier_diario` derivado do tier escolhido (mapa TIER_250→250, TIER_1K→1000, TIER_2K→2000, TIER_10K→10000, TIER_100K→100000, Ilimitado→valor alto), mantendo 250 como default para "Automático" preservado do comportamento atual apenas quando nada for escolhido.
- Mesmo tratamento em `atualizarDuplicado()` (fluxo de Phone Number ID já existente), `salvarEdicao()` e nos `setForm(...)` de reset.
- Reaproveitar a lista `bms` e o mapa de tiers já presentes no arquivo; sem query nova, sem migração de banco e sem alteração em Edge Functions — logo, sem impacto de custo no Cloud.

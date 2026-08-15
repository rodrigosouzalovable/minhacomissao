# Custo do Google Maps Leads: corrigir a estimativa e mostrar a franquia gratuita

## Resposta curta

Os US$ 0,32 que apareceram **não foram cobrados** — é só uma estimativa nossa, e ela está calculada de forma errada.

Como o Google cobra de verdade na Places API (New):

- A cobrança é **por requisição** (por página de até 20 resultados), não por resultado retornado.
- O SKU usado na busca de texto com telefone é o **Text Search (Pro)**, cerca de **US$ 32 por 1.000 requisições** — ou seja, ~US$ 0,032 por requisição.
- Cada SKU tem uma **franquia mensal gratuita** (o Google aplica um teto de uso gratuito por SKU, por mês, na conta de faturamento).

Na sua busca de teste: "pizzaria" em "Goiânia", máx. 10 → **1 requisição**, custo real ~US$ 0,032, e dentro da franquia gratuita mensal isso fica em **US$ 0,00**.

Nosso sistema mostrou US$ 0,32 porque multiplica **10 resultados × 0,032** em vez de **1 requisição × 0,032**. Estimativa 10x maior que o real (e ainda ignora a franquia gratuita).

## O que será ajustado

1. **Cálculo do custo estimado** (tela e histórico de buscas): passar a contar **requisições/páginas**, não resultados. 1 a 20 resultados = 1 requisição; 21 a 40 = 2; 41 a 60 = 3.
2. **Texto do "Custo estimado"** no card de nova busca: mostrar quantas requisições a busca deve consumir e o valor por requisição, deixando claro que é estimativa e que a franquia gratuita mensal do Google pode zerar o valor.
3. **Contador mensal**: reforçar no painel de uso que o número exibido é de **requisições Places** no mês, que é exatamente a unidade que o Google usa para a franquia e para a cobrança.
4. **Corrigir buscas antigas**: recalcular o custo estimado já gravado nas buscas anteriores para a nova regra, para o histórico não continuar mostrando valores inflados.

Nenhuma mudança na forma de buscar, nos limites de segurança (bloqueio em 4800) ou na chave da API.

## Detalhes técnicos

- `supabase/functions/google-maps-buscar-leads/index.ts`: hoje faz `custo = trimmed.length * 0.032`. Passar a usar o número real de páginas consumidas (`pages`) × 0,032, arredondado em 4 casas.
- `src/pages/GoogleMapsLeads.tsx`: ajustar o texto de custo estimado para `Math.ceil(max_resultados / 20)` requisições × US$ 0,032, com nota sobre a franquia gratuita mensal do Google.
- Migração pontual de dados: `UPDATE google_maps_buscas SET custo_estimado_usd = ROUND((CEIL(total_resultados::numeric / 20) * 0.032)::numeric, 4)` nas buscas concluídas.
- Sem alteração em `gm_status_uso` / `gm_incrementar_uso` (já contam por chamada Places, que é a unidade correta).

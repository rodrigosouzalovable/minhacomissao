# IAGO negocia UME apenas pela tabela "Sem Juros + 10%"

O IAGO passa a montar toda proposta de clientes UME usando a mesma tabela "Sem Juros + 10%" criada na calculadora do Inbox: base = total sem juros + 10%, parcelas em 1x, 2x, 4x, 8x, 10x, 12x e 18x, nunca abaixo de R$ 100 por parcela.

## O que muda

1. **Cálculo compartilhado (backend)**
   - Em `supabase/functions/_shared/ume-desconto.ts`, a função `propostaDaUme` ganha a tabela `sem_juros_10`, gerada a partir de `valorSemJuros * 1,1` dividida nas parcelas 1/2/4/8/10/12/18, descartando parcelas abaixo de R$ 100 (mesma regra do dialog).
   - À vista = base cheia (1x). Percentuais de desconto exibidos são calculados sobre o total com juros, para o texto continuar coerente.

2. **IAGO usa essa tabela para UME**
   - Em `supabase/functions/iago-atendimento/index.ts`, a seleção de tabela passa a usar `sem_juros_10` como padrão para o credor UME (as opções antigas continuam disponíveis apenas se o admin escolher explicitamente).
   - Se `valorSemJuros` não vier na consulta, o IAGO cai para a tabela padrão da UME como hoje (sem quebrar atendimento).

3. **Configuração**
   - Em `src/components/admin/IagoConfigDialog.tsx`, adicionar o terceiro botão "Sem Juros + 10%" ao lado de Padrão/Especial e deixá-lo selecionado.
   - Migração: `UPDATE iago_config SET ume_tabela = 'sem_juros_10'` e novo default da coluna.

4. **Consulta manual**
   - `supabase/functions/consultar-ume-desconto/index.ts` passa a aceitar/repassar `sem_juros_10`, mantendo a UI do Inbox coerente com o que o IAGO envia.

## Detalhes técnicos

- Tipo de `tabela` em `propostaDaUme` vira `'padrao' | 'especial' | 'sem_juros_10'`.
- Arredondamento a 2 casas, igual ao frontend (`Math.round(v * 100) / 100`).
- `totalParcelado` para a nova tabela = base (sem juros + 10%), já que não há totais 3x/4x+ vindos do Looker.
- Deploy das edge functions `iago-atendimento` e `consultar-ume-desconto`.

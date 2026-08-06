# Proposta da IA com opções de parcelamento (4x, 8x, 12x, 16x, 20x, 24x)

## Como está hoje (verificado)

Na função `meta-ia-atendimento`, a proposta calcula o valor à vista e **um único** parcelamento: o maior número de parcelas (até 24) cuja parcela fique ≥ R$ 100. O modelo "Proposta de negociação" mostra `até {max_parcelas}x de {valor_parcela}`.

## O que muda

1. **À vista fica exatamente como está** (valor com desconto e % de desconto).
2. **Parcelamento passa a ser uma lista de opções**: 4x, 8x, 12x, 16x, 20x e 24x, cada uma com o valor da parcela calculado sobre o total com desconto parcelado.
3. **Parcela nunca abaixo de R$ 100,00**: cada opção da grade só aparece se a parcela resultante for ≥ R$ 100. Opções acima disso são omitidas.
4. **Ajuste automático quando o valor é baixo**: se nenhuma opção da grade couber (ou sobrar pouca coisa), a IA oferta o maior número de parcelas possível respeitando o mínimo de R$ 100 (ex.: dívida pequena → 2x ou 3x), sempre incluindo pelo menos uma opção parcelada quando o total permitir.
5. **Nova variável no modelo**: `{opcoes_parcelamento}`, que renderiza a lista pronta, por exemplo:

```text
• 4x de R$ 504,00
• 8x de R$ 252,00
• 12x de R$ 168,00
• 16x de R$ 126,00
```

6. **Modelo "Proposta de negociação" reescrito** para o novo formato, mantendo o estilo atual:

```text
Perfeito, {primeiro_nome}! Localizei seu débito! O valor total é de {valor_total}.

Temos as seguintes condições:

💵 *À vista:* {valor_avista} ({desconto_avista_pct}% de desconto)

📄 *Parcelado* (total {valor_parcelado} com {desconto_parcelado_pct}% de desconto):
{opcoes_parcelamento}

Qual opção fica melhor para você: *à vista* ou em quantas parcelas?
```

7. **Resposta do cliente**: quando ele responder com uma quantidade ("12x", "quero em 8 vezes"), a IA registra essa escolha e o aviso ao contato de emergência informa a opção exata (ex.: "12x de R$ 168,00"). Se responder só "parcelado", a IA usa a maior opção válida, como hoje.

## Detalhes técnicos

- `supabase/functions/meta-ia-atendimento/index.ts`: gerar a grade `[4,8,12,16,20,24]` limitada por `max_parcelas` da config, filtrando por `valorParcelado / n >= parcela_minima`; fallback para o maior `n` válido (2..max) quando a grade fica vazia; expor `{opcoes_parcelamento}` (lista formatada) e manter `{max_parcelas}`, `{valor_parcela}`, `{valor_parcelado}` apontando para a maior opção válida (compatibilidade com modelos antigos). Extrair da mensagem do cliente o número de parcelas escolhido e validá-lo contra a grade.
- `src/components/inbox/meta/MetaIAConfigDialog.tsx`: adicionar `{opcoes_parcelamento}` na lista de variáveis clicáveis do modelo de proposta.
- Atualizar o texto do modelo `proposta` na tabela de modelos da IA (migração de dados no registro existente).
- Sem novo cron, polling ou função — nenhum impacto de custo.

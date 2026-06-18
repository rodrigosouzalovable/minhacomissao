## Objetivo
Atualizar a mensagem para mostrar até 4 opções de parcelamento (4x, 8x, 12x, 15x), filtrando as que ficariam abaixo de R$100/parcela, e capitalizar o primeiro nome (Title case).

## Mudanças

### 1. `src/lib/parseCobmaisPlanilha.ts`
- **Capitalizar `{primeiro_nome}`**: aplicar Title Case (primeira letra maiúscula, demais minúsculas) — ex.: `JHONY` → `Jhony`, `jhony` → `Jhony`.
- **Novo placeholder `{opcoes_parcelado}`**: gera bloco multilinha com até 4 opções (4x, 8x, 12x, 15x), filtrando as que resultam em parcela < R$100. Formato de cada linha:
  ```
  ✅ *PARCELADO* em {N}x de {valor_parcela}
     (total R$ {valor_total}, {desconto}% de desconto)
  ```
  Separadas por linha em branco. Usa `descontoParceladoPct` do contexto.
- Manter placeholders antigos (`{parcelado_qtd}`, `{valor_cada_parcela_proposta}`, etc.) para retrocompatibilidade.

### 2. `src/pages/ModeloMensagem.tsx`
- **`TEMPLATE_PADRAO`**: trocar o bloco fixo de "PARCELADO em {parcelado_qtd}x..." por `{opcoes_parcelado}`. Resultado final:
  ```
  Olá, {primeiro_nome}! Tudo bem?

  Identificamos {qtd_parcelas_atraso} parcelas em aberto a {dias_atraso} dias de atraso no contrato {contrato}, totalizando *R$ {total_atraso}*.

  💰 *Condições especiais para hoje:*

  ✅ *À VISTA* com {desconto_vista_pct}% de desconto:
     *R$ {valor_quitacao}*

  {opcoes_parcelado}

  Posso confirmar qual opção é melhor para você?
  ```
  (Remove `📋 Parcelas em aberto` e `{lista_parcelas}` conforme exemplo do usuário.)
- Remover o controle "Nº parcelas (parcelado)" do painel de configurações globais (não faz mais sentido — agora são 4, 8, 12, 15 fixos). Manter `descVistaGlobal` e `descParceladoGlobal`. `calcMaxParcelas` deixa de ser necessário e é removido (junto com os usos em `aplicarGlobaisATodos`, `handleFile`, `setLinhaCfg`, `mensagemDoCliente`).
- Layout do grid de configs passa de 4 para 3 colunas.

## Regra de filtro (R$100)
Para cada N ∈ [4, 8, 12, 15]:
- `valorTotal = totalAtraso * (1 - descParceladoPct/100)`
- `valorParcela = valorTotal / N`
- incluir apenas se `valorParcela >= 100`
- Se nenhuma opção sobrar (dívida < R$400 após desconto), incluir ao menos a opção de menor N viável (`Math.floor(valorTotal/100)`x), garantindo ≥1 opção.

## Fora do escopo
- Backend/RLS, edge functions, `EditarTemplateMensagemDialog`, outras páginas.



# Plano: Reconfigurar layout Montreal

## Mudança
A planilha Montreal não tem mais a coluna "Tipo Título" (antiga coluna G). As colunas a partir de G deslocam uma posição para a esquerda:

| Coluna | Antes | Agora |
|--------|-------|-------|
| G | Tipo Título | Atraso (dias) |
| H | Atraso (dias) | Nro Nota |
| I | Nro Nota | Desdob. |
| J | Desdob. | Vlr do Desdobramento |
| K | Valor | Dt. Venc. Inicial |
| L | Dt. Venc. Inicial | *(removida)* |

## Alterações em `src/pages/ImportarDevedores.tsx`

1. **Linha 48** - Atualizar `DESCRICOES.montreal` para refletir as novas colunas (sem "Tipo Título", 11 colunas em vez de 12)

2. **Linhas 120-151** - `parseMontreal`: Ajustar mapeamento:
   - `atraso` ← `row['G']` (antes era ignorado/vencimento)
   - `contrato` (Nro Nota) ← `row['H']` (antes `row['I']`)
   - `descricao` (Desdob.) ← `row['I']` (antes `row['G']`)
   - `valor` ← `row['J']` (antes `row['K']`)
   - `vencimento` ← `row['K']` (antes `row['L']`)


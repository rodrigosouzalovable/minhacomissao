# Primeira linha da planilha estava sendo descartada

## Causa confirmada

Na planilha `MMP 1.xlsx` o CPF `080.490.033-70` tem 12 parcelas (soma exata de G = 1.403,80, igual à coluna H). O sistema mostrou R$ 1.344,10 e "11 contratos" — exatamente 1.403,80 menos a primeira parcela de 59,70.

Motivo: a leitura da planilha sempre descarta a primeira linha, assumindo que ela é cabeçalho (`json.slice(1)` em `src/pages/ImportarDevedores.tsx`, linha 1355). Essa planilha não tem cabeçalho: a linha 1 já é dados. Isso afeta todos os arquivos sem cabeçalho, não só esse cliente.

## Correção

- Detectar automaticamente se a primeira linha é cabeçalho: se a coluna A da linha 1 contiver um CPF/CNPJ válido (11 ou 14 dígitos após limpar pontuação) e a coluna G for numérica, a linha é tratada como dado e não é descartada.
- Caso contrário (texto tipo "CPF", "Nome"), continua sendo descartada como hoje.
- Aplicar a mesma detecção nos layouts Padrão/MMP, Montreal, Pesquisa, UME consolidado e UME aporte, que hoje usam `.slice(1)` fixo.

## Verificação

Após a correção, reimportar `MMP 1.xlsx`: o cliente ADAILTO AUGUSTO FERREIRA deve aparecer com R$ 1.403,80 e 12 parcelas, e o preview total deve subir de 4.999 para 5.000 registros, sem badge de divergência com a coluna H.

## Detalhes técnicos

- Novo helper local `temCabecalho(rows)` em `ImportarDevedores.tsx`, usado antes de `.slice(1)` (linhas 1274, 1285, 1311, 1323, 1355, 1409, 1413).
- Nenhuma mudança em banco de dados, edge functions ou no portal.

# Formato de valor por coluna sempre disponível (Envio Meta)

Na planilha importada a coluna C traz números como `797.796`, `1033.29` e `351.25199999999995`, e no diálogo "Mapear colunas da planilha" ela aparece crua, sem o seletor de formato. O objetivo é poder escolher o formato `R$ 797,80` para qualquer coluna que pareça valor — e também forçar manualmente em qualquer coluna.

## O que muda

1. **Seletor de formato em todas as colunas**
   O pequeno seletor abaixo do papel da coluna (`R$ 4.607,58` / `4.607,58` / `Texto original`) passa a aparecer em toda coluna, não só nas detectadas como monetárias. Assim, mesmo que a detecção automática falhe, você troca o formato na hora.

2. **Detecção mais tolerante**
   Números com mais de 2 casas decimais (como `351.25199999999995` e `797.796`) passam a contar como valor na detecção automática, então a coluna C já abre com `R$ ...` pré-selecionado.

3. **Arredondamento em 2 casas**
   `797.796` → `R$ 797,80`; `351.25199999999995` → `R$ 351,25`; `1033.29` → `R$ 1.033,29`.

4. **Pré-visualização e envio**
   A tabela de conferência mostra o valor já formatado, e é esse mesmo texto que vai para a variável do template (`{{2}}`) e para o disparo.

## Detalhes técnicos

- `src/lib/valorBR.ts` — em `amostrasParecemValor`, tratar como decimal qualquer número com separador seguido de 1+ dígitos (hoje só 1-2), mantendo as exclusões de telefone/CPF/CNPJ e ano. A formatação em `formatarValorBR` já arredonda para 2 casas via `toLocaleString`, sem alteração.
- `src/components/meta/MapearColunasImportDialog.tsx` — renderizar o seletor de formato sem a condição `colunasMonetarias.has(c) || fmtCol(c) !== "raw"`.
- Sem mudanças em banco, edge functions ou worker de envio.

# Fix: planilha do Cob+ com `!ref` inválido

## Causa raiz

O arquivo `.xlsx` exportado pelo Cob+ grava o atributo `<dimension>` da aba apontando só para a linha do cabeçalho (`A1:R1`), mesmo quando há dados em `A2:R2` em diante. SheetJS usa esse `!ref` para iterar células e por isso `sheet_to_json` devolve só 1 linha → o parser dispara "Aba Cobrança vazia".

Reproduzido em Node com o arquivo enviado: `!ref = "A1:R1"`, mas `A2..R2` existem e contêm o cliente.

## Correção

Em `src/lib/parseCobmaisPlanilha.ts`, dentro de `sheetToRows`, antes do `sheet_to_json`:

1. Varrer as chaves de célula (`A1`, `B2`, …, ignorando metadados `!*`).
2. Calcular a maior linha e maior coluna reais.
3. Sobrescrever `sheet['!ref']` com o range correto via `XLSX.utils.encode_range`.
4. Chamar `sheet_to_json(sheet, { header: 1, defval: '', raw: true })` normalmente.

Isso conserta as três abas (`Cobrança`, `Telefones`, `Parcelas`) de uma vez e não muda nada na UI nem no template.

## Fora de escopo

- Mudanças visuais ou de fluxo na aba `/modelo-mensagem`.
- Outras abas da planilha (não usadas hoje).

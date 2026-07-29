## Diagnóstico (confirmado)

A planilha tem 30.845 linhas de dados (aba `Planilha1`) e 26.396 CPFs distintos. O sistema mostrou 16.629 — exatamente o número de linhas cujo CPF tem 11 dígitos.

Motivo: o Excel removeu os zeros à esquerda dos CPFs. Distribuição real na planilha:

```text
11 dígitos: 16.629  -> aceitos
10 dígitos: 12.324  -> descartados
 9 dígitos:  1.708  -> descartados
 8 dígitos:    172  -> descartados
 7 dígitos:     11  -> descartados
 6 dígitos:      1  -> descartado
```

A função `parsePesquisa` (src/pages/ImportarDevedores.tsx, ~linha 579) monta a linha e no final aplica `.filter(r => r.cpf.length >= 11 && r.nome.length > 0)`, ou seja, joga fora tudo que veio truncado — mesmo que a importação final já faça `padStart(11,'0')` depois.

## Correção

1. Em `parsePesquisa`, normalizar o CPF **antes** de validar:
   - até 11 dígitos → `padStart(11, '0')`
   - de 12 a 14 dígitos → `padStart(14, '0')` (CNPJ)
   - descartar apenas se ficar vazio, todo zeros, ou fora de 11/14 dígitos.
2. Manter o filtro de nome preenchido.
3. Garantir que a mesma normalização seja usada nos dois pontos de gravação (`prepararJob` ~linha 1467 e `handleImport` ~linha 1639), para que o `padStart(11)` não corrompa CNPJs de 14 dígitos.
4. Contador de preview passa a refletir as linhas válidas; a deduplicação por `CPF + últimos 8 dígitos do telefone` continua igual (resulta em ~28.657 vínculos únicos nesta planilha).

## Observação sobre a planilha

Os dados estão na 2ª aba (`Planilha1`); a 1ª aba (`Cobrança`) só tem cabeçalho. Se o leitor atual usa a primeira aba com dados, isso já funcionou nesse arquivo — vou apenas confirmar que a seleção de aba escolhe a primeira aba **com linhas de dados**, sem alterar o comportamento atual dos outros layouts.

## Resultado esperado

Preview passa de 16.629 para ~30.845 registros (≈28.657 vínculos após dedup), cobrindo os 26.396 CPFs.

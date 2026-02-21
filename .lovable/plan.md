

## Atualizar parser COBMAIS para novo layout de colunas

### Problema

O parser COBMAIS atual espera um layout multi-abas com colunas especificas (C=nome, D=credor, E=contrato, F=atraso, M=risco). A planilha do usuario tem um layout diferente na primeira aba:

```text
A = CPF/CNPJ
B = CLIENTE (nome)
C = CONTRATO
D = NUMERO (numero da parcela)
E = VENCIMENTO (data)
F = VALOR (valor da parcela)
G = TOTAL (valor total do contrato)
```

Cada CPF pode ter multiplos contratos, e cada contrato tem multiplas parcelas (linhas). O sistema deve agregar por CPF+CONTRATO, criando um registro por contrato unico.

### Solucao

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Reescrever a funcao `parseCobmais` para ler o novo mapeamento de colunas:
   - A = CPF/CNPJ (com resolucao de zeros a esquerda via Aba 2, se disponivel)
   - B = Nome do cliente
   - C = Numero do contrato
   - E = Data de vencimento (usar a primeira ocorrencia)
   - F = Valor da parcela
   - G = Total do contrato (usar como valor_original e valor_atualizado)

2. Agregar por CPF + CONTRATO: se o mesmo CPF tem o contrato 50010938 repetido em varias parcelas, criar apenas um registro com o valor TOTAL (coluna G)

3. Manter a logica de telefones da Aba 2 (se existir) para associar telefones aos CPFs

4. Atualizar a descricao do layout COBMAIS para refletir as novas colunas

5. Ajustar o `handleImport` para usar `r.atraso` (que armazenara o vencimento) como `data_vencimento` no caso COBMAIS, similar ao layout Montreal

### Secao tecnica

**Mudancas na funcao `parseCobmais`:**
- Mapeamento: `row['A']` = CPF, `row['B']` = nome, `row['C']` = contrato, `row['E']` = vencimento, `row['F']` = valor parcela, `row['G']` = total
- Chave de agrupamento: `cpf + '|' + contrato` para evitar duplicatas
- O campo `atraso` do DevedorRow sera usado para armazenar o vencimento (para reusar a logica de parseDate no handleImport)
- O campo `valor_original` e `valor_atualizado` receberao o valor da coluna G (TOTAL)
- Remover logs de debug da versao anterior

**Mudanca na constante DESCRICOES:**
- Atualizar texto do cobmais para: `'A = CPF/CNPJ, B = Cliente, C = Contrato, D = Numero, E = Vencimento, F = Valor, G = Total | Aba 2: Telefones (opcional)'`

**Mudanca no `handleImport` (linha ~335):**
- Adicionar condicao para cobmais usar `parseDate(r.atraso)` como `data_vencimento`, igual ao montreal

- Unico arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Sem alteracoes no banco de dados
- Sem novas dependencias

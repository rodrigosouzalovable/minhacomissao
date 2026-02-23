
# Corrigir Layout de Importacao MONTREAL

## Problema
O mapeamento atual das colunas do layout MONTREAL nao corresponde ao arquivo Excel real. O arquivo tem colunas diferentes do que o codigo espera.

## Estrutura Real do Excel

| Coluna | Header no Excel |
|--------|----------------|
| A | Parceiro (codigo numerico) |
| B | Razao Social do Parceiro |
| C | CNPJ / CPF |
| D | FONE1 |
| E | FONE2 |
| F | Apelido |
| G | Tipo de Titulo |
| H | Atraso (dias) |
| I | Nro Nota |
| J | Desdob. |
| K | Vlr do Desdobramento |
| L | Dt. Venc. Inicial |

## Mapeamento Correto

| Campo no Sistema | Coluna Excel | Valor |
|-----------------|-------------|-------|
| cpf | C | CNPJ/CPF |
| nome | B | Razao Social do Parceiro |
| contrato | I | Nro Nota |
| descricao | G | Tipo de Titulo |
| atraso (vencimento) | L | Dt. Venc. Inicial |
| valor_original | K | Vlr do Desdobramento |
| telefone | D ou E | FONE1 ou FONE2 |

## Detalhes Tecnicos

### Arquivo: `src/pages/ImportarDevedores.tsx`

**1. Atualizar descricao do layout (linha 48):**
```
montreal: 'A = Parceiro, B = Razao Social, C = CNPJ/CPF, D = Fone1, E = Fone2, F = Apelido, G = Tipo Titulo, H = Atraso (dias), I = Nro Nota, J = Desdob., K = Valor, L = Dt. Venc. Inicial'
```

**2. Atualizar funcao `parseMontreal` (linhas 119-137):**
- C -> cpf (antes era A)
- B -> nome (ja correto)
- I -> contrato (antes era C)
- G -> descricao/tipo titulo (antes era F)
- L -> atraso/vencimento (antes era H)
- K -> valor (antes era J)
- D/E -> telefones (antes eram L/M)

**3. Atualizar tabela de preview (linhas 561-603):**
Ajustar os headers e dados exibidos para corresponder ao novo mapeamento:
- Nome, Contrato (Nro Nota), Tipo Titulo, Atraso (dias), Vencimento, Valor, Telefone

**4. Atualizar mapeamento de insercao (linhas 306-308):**
O `data_vencimento` para montreal usa `r.atraso` que agora contera a data de vencimento da coluna L.

Nenhuma alteracao no banco de dados e necessaria.

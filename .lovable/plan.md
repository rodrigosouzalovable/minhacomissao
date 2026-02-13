

## Plano: Atualizar leitura da planilha Excel na importacao de devedores

### Novo mapeamento de colunas

A planilha agora segue este layout fixo:

| Coluna | Campo | Mapeamento no banco |
|--------|-------|-------------------|
| A | CPF/CNPJ | `cpf` |
| B | NASCIMENTO | `data_vencimento` (reaproveitado) |
| C | CLIENTE | `nome` |
| D | CREDOR | `descricao` |
| E | CONTRATO | `contrato` |
| F | ATRASO | Exibido no preview, nao salvo (sem coluna no banco) |
| G | RISCO (valor devido) | `valor_original` e `valor_atualizado` |

### Alteracoes no arquivo `src/pages/ImportarDevedores.tsx`

1. **Atualizar interface `DevedorRow`** -- adicionar campos `nascimento`, `credor` e `atraso`; remover campos que nao existem mais

2. **Usar `sheet_to_json` com `header: "A"`** -- ler por posicao de coluna (A, B, C...) em vez de buscar por nome de cabecalho, garantindo leitura correta independente do nome das colunas. Pular a primeira linha (cabecalho)

3. **Atualizar parsing**:
   - Coluna A → `cpf` (remover caracteres nao numericos)
   - Coluna B → `nascimento` (exibir como texto)
   - Coluna C → `nome`
   - Coluna D → `credor` (salvo como `descricao`)
   - Coluna E → `contrato`
   - Coluna F → `atraso` (apenas exibicao)
   - Coluna G → `valor_original` e `valor_atualizado` (parse numerico)

4. **Atualizar preview (tabela)** -- colunas: CPF/CNPJ, Nascimento, Cliente, Credor, Contrato, Atraso, Risco (R$)

5. **Atualizar descricao do upload** -- texto explicativo com as novas colunas esperadas

6. **Manter logica de insert** -- mesmo mapeamento para a tabela `devedores`, apenas com os campos atualizados


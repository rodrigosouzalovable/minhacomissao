
## Juntar contratos de clientes na aba Clientes

### Resumo
Adicionar duas funcionalidades na tabela de resultados:
1. **Botao "Juntar CPFs Iguais"**: agrupa automaticamente todos os registros com o mesmo CPF, soma os valores, concatena os contratos no primeiro registro e desativa os demais.
2. **Selecao manual**: checkboxes em cada linha para selecionar contratos especificos e junta-los em um so, independente do CPF.

### Como funciona a juncao

Dado N registros selecionados (ou agrupados por CPF):
- O **primeiro registro** (mais antigo ou primeiro da lista) e mantido
- Seus campos sao atualizados:
  - `valor_original` = soma de todos os `valor_original`
  - `valor_atualizado` = soma de todos os `valor_atualizado`
  - `contrato` = concatenacao de todos os contratos separados por `, `
- Os **demais registros** sao desativados (`ativo = false`)

### Interface

1. **Barra de acoes** acima da tabela de resultados com:
   - Botao "Juntar CPFs Iguais" (icone Merge): analisa os resultados atuais, encontra CPFs duplicados e realiza a juncao automatica para cada grupo
   - Botao "Juntar Selecionados" (aparece quando 2+ checkboxes estao marcados): junta os registros selecionados manualmente

2. **Checkbox** em cada linha da tabela para selecao manual

3. **Dialog de confirmacao** antes de executar a juncao, mostrando:
   - Quantos registros serao afetados
   - Valor total resultante
   - Botao Confirmar / Cancelar

### Alteracoes tecnicas

**Arquivo: `src/pages/Clientes.tsx`**

1. Adicionar state `selectedIds` (Set de IDs selecionados via checkbox)
2. Adicionar coluna de checkbox no header e em cada linha da tabela
3. Adicionar botao "Juntar CPFs Iguais" no CardHeader dos resultados
4. Adicionar botao "Juntar Selecionados" (visivel quando selectedIds.size >= 2)
5. Criar funcao `handleMergeByCpf`:
   - Agrupa `results` por CPF normalizado
   - Para cada grupo com 2+ registros, chama a logica de merge
6. Criar funcao `handleMergeSelected`:
   - Pega os registros dos IDs selecionados
   - Chama a logica de merge
7. Criar funcao `mergeRecords(records: ClienteRow[])`:
   - Calcula soma de valores e concatena contratos
   - Faz UPDATE no primeiro registro (valores somados, contratos concatenados)
   - Faz UPDATE nos demais registros (ativo = false)
   - Usa `supabase.from('devedores').update(...)` para ambas operacoes
8. Adicionar Dialog de confirmacao com resumo antes de executar
9. Apos merge, recarregar a pesquisa atual chamando `handleSearch(page)`

**Nenhuma alteracao de schema necessaria** - a tabela `devedores` ja possui todos os campos necessarios (valor_original, valor_atualizado, contrato, ativo).

**Permissoes**: A operacao de UPDATE ja e coberta pela RLS existente (admins podem gerenciar devedores, usuarios autenticados podem ver).

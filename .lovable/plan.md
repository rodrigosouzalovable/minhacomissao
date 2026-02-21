

## Adicionar seletor de credor destino na importacao + filtro dinamico na aba Clientes

### Resumo

Duas mudancas principais:
1. Na pagina de importacao, adicionar um campo "Credor de destino" para que o usuario escolha para qual credor os devedores serao importados (sobrescrevendo o credor da planilha).
2. Na pagina de Clientes, tornar o filtro de credor dinamico (buscar do banco) e exibir toast quando parsing retorna 0 registros.

### Alteracoes

**Arquivo 1: `src/pages/ImportarDevedores.tsx`**

1. Adicionar novo estado `credorDestino` (string, inicialmente vazio)
2. Adicionar um campo Select "Credor de Destino" abaixo do seletor de layout, com opcoes:
   - MUNDO DA MODA
   - UME | NOVO MUNDO
   - MONTREAL
   - Campo livre para digitar outro credor (Input condicional)
3. No `handleImport`, usar `credorDestino` como valor do campo `credor` de todos os registros importados (em vez do credor que vem da planilha)
4. Tambem gravar o `credorDestino` na tabela `importacoes` (campo `credor`) para o historico
5. Adicionar validacao: se `credorDestino` estiver vazio, exibir toast de erro e nao permitir importar
6. Apos o parsing, se `rows.length === 0`, exibir toast: "Nenhum registro encontrado na planilha"

**Arquivo 2: `src/pages/Clientes.tsx`**

1. Remover a constante fixa `CREDORES`
2. Adicionar estado `credores` e um `useEffect` que busca credores distintos do banco:
   ```sql
   SELECT DISTINCT credor FROM devedores WHERE ativo = true AND credor IS NOT NULL
   ```
3. Popular o Select de credor com os resultados dinamicos

### Secao tecnica

- Arquivos modificados: `src/pages/ImportarDevedores.tsx`, `src/pages/Clientes.tsx`
- Sem alteracoes no banco de dados (o campo `credor` ja existe nas tabelas `devedores` e `importacoes`)
- Sem novas dependencias
- O `credorDestino` permite tanto opcoes pre-definidas quanto entrada livre para novos credores




## Mudancas na ficha do cliente

### 1. Badge dinamico: "novo" vira "andamento" quando existem eventos

No cabecalho, ao inves de exibir `devedor.estagio` diretamente, calcular o estagio visual:
- Se `devedor.estagio === 'novo'` **e** `eventos.length > 0`, exibir badge "andamento" (com cor diferente, ex: azul/amarelo)
- Caso contrario, exibir o estagio original do banco

Isso sera uma mudanca apenas visual (no frontend), sem alterar o valor no banco de dados.

### 2. Nome do operador nos eventos

Atualmente `criado_por` armazena o `user.id`. Para exibir o nome:
- Ao carregar os eventos, buscar tambem os nomes dos operadores na tabela `profiles` (que tem coluna `nome`)
- Criar um mapa `userId -> nome` e exibir o nome em cada card de evento, abaixo da data/hora

### Detalhes tecnicos

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

1. **Estado para nomes de operadores:** Adicionar `operadorNomes: Record<string, string>` para mapear IDs para nomes

2. **fetchData (linhas 143-149):** Apos carregar eventos, extrair os IDs unicos de `criado_por`, consultar `profiles` para obter os nomes, e salvar no estado

3. **Badge no cabecalho (linha 250):** Substituir `devedor.estagio` por logica condicional:
   - `estagio === 'novo' && eventos.length > 0` -> exibir "andamento"
   - Senao -> manter estagio original

4. **Card de evento (linhas 452-455):** Adicionar o nome do operador na linha de data/hora, algo como: `"12/02/2025 14:30 - por Fulano"`


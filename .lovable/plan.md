

## Corrigir limite de 1000 registros na busca de Clientes

### Problema

O Supabase tem um limite padrao de 1000 linhas por consulta. Com 50 mil parcelas importadas, a busca retorna apenas 1000 linhas, que agrupadas por CPF resultam em ~184 clientes.

### Solucao

Implementar carregamento paginado em lotes na funcao `handleSearch` do arquivo `src/pages/Clientes.tsx`, buscando todas as linhas em loops de 1000 ate nao haver mais resultados.

### Arquivo: `src/pages/Clientes.tsx`

**Mudanca na funcao `handleSearch` (linhas 201-243):**

Substituir a consulta unica por um loop que busca em lotes de 1000:

```text
// DE:
const { data, error } = await query;
if (!error && data) { setRawResults(data as ClienteRow[]); }

// PARA:
const PAGE_FETCH = 1000;
let allData: ClienteRow[] = [];
let from = 0;
let keepFetching = true;

while (keepFetching) {
  const { data, error } = await query.range(from, from + PAGE_FETCH - 1);
  if (error) { toast.error('Erro na busca: ' + error.message); break; }
  if (data) allData = [...allData, ...(data as ClienteRow[])];
  if (!data || data.length < PAGE_FETCH) keepFetching = false;
  else from += PAGE_FETCH;
}

setRawResults(allData);
```

**Problema tecnico com reutilizacao de query:** O objeto `query` do Supabase nao pode ser reutilizado em um loop (o `.range()` modifica o builder). A solucao e mover a construcao do query para dentro do loop, recriando-o a cada iteracao.

```text
while (keepFetching) {
  let q = supabase.from('devedores')
    .select('id, nome, cpf, credor, contrato, valor_original, valor_atualizado, estagio')
    .eq('ativo', true)
    .order('criado_em', { ascending: false })
    .range(from, from + PAGE_FETCH - 1);

  // Reaplicar filtros
  if (busca.trim()) { ... }
  if (telefone.trim()) { ... }
  if (credor !== 'todos') { ... }
  if (estagio !== 'todos') { ... }

  const { data, error } = await q;
  ...
}
```

**Tambem corrigir o fetch de credores (linhas 90-105):** A mesma limitacao de 1000 afeta a listagem de credores unicos. Adicionar `.limit(10000)` ou paginacao similar para garantir que todos os credores aparecam no filtro.

### Resultado esperado

- Todos os ~50 mil registros serao carregados (em lotes de 1000)
- A interface de clientes mostrara todos os CPFs unicos agrupados corretamente
- O indicador "Pesquisando..." continuara visivel durante todo o carregamento

### Impacto
- Unico arquivo modificado: `src/pages/Clientes.tsx`
- Sem alteracoes no banco de dados
- Sem novas dependencias


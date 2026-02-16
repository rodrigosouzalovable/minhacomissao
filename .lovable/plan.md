

## Agrupar Contratos por CPF/CNPJ na Pagina de Clientes

### Problema Atual
Quando o usuario pesquisa por um credor (ex: MONTREAL), a tabela mostra uma linha para cada contrato, repetindo o mesmo cliente varias vezes (como "BR ELETRON TOCANTINS" aparecendo 7+ vezes com CPFs identicos).

### Solucao
Agrupar automaticamente os resultados por CPF/CNPJ apos a busca, exibindo cards individuais por cliente com contratos unificados e valores somados.

### Modificacoes em src/pages/Clientes.tsx

**1. Buscar todos os registros (sem paginacao no banco)**
- Remover `.range()` da query para trazer todos os resultados do filtro (limite de 1000 do Supabase)
- A paginacao sera feita no frontend sobre os dados agrupados

**2. Agrupar resultados por CPF normalizado**
- Apos receber os dados, aplicar `reduce` para agrupar por CPF (removendo caracteres especiais)
- Cada grupo tera: nome, cpf, credor, quantidade de contratos, valor total (soma de `valor_atualizado`), id do primeiro registro (para navegacao)

**3. Alterar a tabela de resultados**
- Remover coluna "Contrato" individual
- Adicionar coluna "Contratos" mostrando a quantidade (ex: "5 contratos")
- Coluna "Valor (R$)" mostra o total somado
- Coluna "Estagio" mostra o estagio predominante ou badge multiplo
- "Ver Ficha" navega para `/clientes/:id` usando o id do primeiro registro do grupo
- Contagem de clientes no cabecalho reflete a quantidade de grupos unicos, nao de contratos

**4. Paginacao no frontend**
- Paginar sobre o array agrupado em vez dos resultados brutos
- Manter PAGE_SIZE = 20 (agora 20 clientes por pagina, nao 20 contratos)

### Detalhes Tecnicos

```text
Interface ClienteAgrupado {
  id: string           // id do primeiro registro (para navegacao)
  nome: string
  cpf: string
  credor: string
  qtdContratos: number
  valorTotal: number
  estagios: string[]   // lista unica de estagios dos contratos
}
```

Logica de agrupamento:
```text
results.reduce((acc, row) => {
  const cpfNorm = row.cpf.replace(/\D/g, '');
  if (!acc[cpfNorm]) {
    acc[cpfNorm] = { id: row.id, nome: row.nome, cpf: row.cpf, credor: row.credor, qtdContratos: 0, valorTotal: 0, estagios: [] };
  }
  acc[cpfNorm].qtdContratos += 1;
  acc[cpfNorm].valorTotal += row.valor_atualizado;
  if (!acc[cpfNorm].estagios.includes(row.estagio)) acc[cpfNorm].estagios.push(row.estagio);
  return acc;
}, {})
```

### Arquivo envolvido

| Arquivo | Acao |
|---|---|
| src/pages/Clientes.tsx | Modificar (agrupamento + nova tabela + paginacao frontend) |


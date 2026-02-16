

## Adicionar campo Telefone funcional na aba Clientes

### Problema atual
O campo telefone foi removido porque a tabela `devedores` nao possui uma coluna de telefone, o que fazia com que o filtro nao funcionasse.

### Solucao
Adicionar uma coluna `telefone` na tabela `devedores` e reintegrar o campo de pesquisa funcional.

### Alteracoes

**1. Migracao SQL**
- Adicionar coluna `telefone` (text, nullable) na tabela `devedores`

**2. Arquivo: `src/pages/Clientes.tsx`**
- Restaurar o state `telefone` e o campo de input correspondente
- Adicionar o filtro `telefone` na query de busca usando `ilike`
- Incluir `telefone` na validacao de filtros (se telefone estiver preenchido, permitir a pesquisa)

**3. Arquivo: `src/pages/ImportarDevedores.tsx`**
- Nenhuma alteracao necessaria por enquanto, ja que a planilha de importacao nao possui coluna de telefone. O campo podera ser preenchido manualmente no futuro.

### Detalhes tecnicos

SQL da migracao:
```sql
ALTER TABLE public.devedores ADD COLUMN telefone text;
```

Filtro na query:
```typescript
if (telefone.trim()) query = query.ilike('telefone', `%${telefone.trim().replace(/\D/g, '')}%`);
```

Validacao atualizada:
```typescript
if (!nome.trim() && !cpf.trim() && !telefone.trim() && credor === 'todos' && estagio === 'todos') {
  toast.error('Preencha ao menos um filtro para pesquisar.');
  return;
}
```


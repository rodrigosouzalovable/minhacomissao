

## Barra de pesquisa unificada para Nome e CPF

### Problema

Atualmente existem campos separados para Nome e CPF. O usuario quer um unico campo de pesquisa que busque simultaneamente por nome OU por CPF.

### Solucao

Substituir os campos separados de "Nome" e "CPF" por um unico campo "Nome ou CPF". Na query ao banco, usar `.or()` para buscar em ambas as colunas.

### Alteracoes em `src/pages/Clientes.tsx`

**1. Unificar os estados `nome` e `cpf` em um unico estado `busca`**

Remover os estados `nome` e `cpf` separados e criar um unico estado `busca`.

**2. Atualizar o campo de input no formulario**

Substituir os dois inputs (Nome e CPF) por um unico campo:
```
Nome ou CPF/CNPJ: [___________________________]
```

**3. Atualizar a logica de pesquisa em `handleSearch`**

Quando o campo `busca` estiver preenchido, verificar se o texto contem apenas digitos (ou formatacao de CPF). Se sim, buscar pelo CPF normalizado. Caso contrario, buscar por nome. Para cobrir ambos os casos, usar `.or()`:

```typescript
if (busca.trim()) {
  const termLimpo = busca.trim().replace(/\D/g, '');
  if (termLimpo.length > 0) {
    // Pode ser CPF ou nome com numeros - buscar em ambos
    query = query.or(`nome.ilike.%${busca.trim()}%,cpf.ilike.%${termLimpo}%`);
  } else {
    query = query.ilike('nome', `%${busca.trim()}%`);
  }
}
```

**4. Atualizar `handleClear`**

Trocar `setNome('')` e `setCpf('')` por `setBusca('')`.

**5. Atualizar a validacao de filtros**

Trocar `!nome.trim() && !cpf.trim()` por `!busca.trim()`.

### Secao tecnica

- Arquivo modificado: `src/pages/Clientes.tsx`
- Os campos de Telefone, Credor e Estagio permanecem inalterados
- A busca por CPF continua normalizada (sem pontos/tracos)
- A busca por nome usa `ilike` para ser case-insensitive


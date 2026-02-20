

## Corrigir filtro de busca na pagina Meus Acordos

### Problema

Quando o usuario pesquisa por nome (texto sem numeros), o filtro nao funciona corretamente. Todos os acordos continuam aparecendo.

**Causa raiz:** Na logica de filtro (linha 458), quando o texto de busca nao contem numeros, `search.replace(/\D/g, '')` resulta em string vazia `""`. Como `qualquerTexto.includes("")` sempre retorna `true` em JavaScript, a condicao do CPF passa para TODOS os acordos, anulando o filtro por nome.

### Solucao

Alterar a logica de filtro para que a busca por CPF so seja tentada quando o texto de busca realmente contem digitos.

### Alteracao em `src/pages/Acordos.tsx`

**Linha 458** - Atualizar a logica de `matchesSearch`:

De:
```typescript
const matchesSearch = acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) || 
  (acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(search.replace(/\D/g, '')));
```

Para:
```typescript
const searchLower = search.toLowerCase();
const searchDigits = search.replace(/\D/g, '');
const matchesSearch = acordo.cliente_nome.toLowerCase().includes(searchLower) || 
  (searchDigits.length > 0 && acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(searchDigits));
```

A unica diferenca e adicionar `searchDigits.length > 0` como condicao antes de comparar CPFs, evitando que uma busca puramente textual passe no filtro de CPF por causa da string vazia.


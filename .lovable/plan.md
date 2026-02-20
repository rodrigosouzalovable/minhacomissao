

## Adicionar busca por CPF na pagina Acordos da Equipe

### Situacao atual

- **Meus Acordos (`Acordos.tsx`)**: Ja busca por nome E CPF. Nenhuma alteracao necessaria.
- **Acordos da Equipe (`EquipeAcordos.tsx`)**: Busca apenas por nome do cliente e nome do funcionario. Falta o CPF.

### Alteracao

**Arquivo: `src/pages/EquipeAcordos.tsx`** (linhas 384-387)

Adicionar `acordo.cliente_cpf` na logica de filtro de busca:

```typescript
// De:
const matchesSearch = 
  acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
  acordo.funcionario_nome?.toLowerCase().includes(search.toLowerCase());

// Para:
const matchesSearch = 
  acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
  acordo.funcionario_nome?.toLowerCase().includes(search.toLowerCase()) ||
  (acordo.cliente_cpf && acordo.cliente_cpf.includes(search));
```

Alteracao simples em uma unica linha, sem impacto em outras funcionalidades.


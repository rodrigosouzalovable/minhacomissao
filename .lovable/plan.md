

## Busca por CPF com ou sem formatacao

### Problema

Atualmente a busca por CPF compara o texto digitado diretamente com o valor armazenado. Se o usuario digitar "12345678901" mas o CPF estiver salvo como "123.456.789-01" (ou vice-versa), a busca nao encontra.

### Solucao

Normalizar ambos os lados (remover pontos e tracos) antes de comparar. Alteracao em dois arquivos:

**1. `src/pages/EquipeAcordos.tsx`** (linha 387)

```typescript
// De:
(acordo.cliente_cpf && acordo.cliente_cpf.includes(search));

// Para:
(acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(search.replace(/\D/g, '')));
```

**2. `src/pages/Acordos.tsx`** - mesma alteracao no filtro de busca por CPF, normalizando com `.replace(/\D/g, '')` em ambos os lados da comparacao.

Isso permite buscar por "123.456.789-01", "12345678901", ou ate parcial como "123.456".


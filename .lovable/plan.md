

## Mudanças

**Arquivos:** `src/pages/Acordos.tsx` e `src/pages/EquipeAcordos.tsx`

### 1. Trim e normalização de espaços no nome
- Aplicar `.trim()` no termo de busca antes de comparar.
- Aplicar `.trim()` também em `cliente_nome` ao comparar (caso o nome cadastrado tenha espaços extras no início/fim).
- Continuar usando `.toLowerCase()` para case-insensitive.

### 2. Busca por telefone
- Em `Acordos.tsx`: já lê `cliente_telefone` no select. Adicionar comparação por dígitos: `acordo.cliente_telefone?.replace(/\D/g,'').includes(searchDigits)`.
- Em `EquipeAcordos.tsx`: confirmar que `cliente_telefone` está no select da query (verificarei). Se não estiver, adicionar ao `.select(...)` e à interface `AcordoComFuncionario`. Aplicar mesma comparação.

### 3. Lógica unificada de match (em ambas as páginas)
```
const termo = search.trim().toLowerCase();
const digitos = search.replace(/\D/g, '');
const nome = acordo.cliente_nome?.trim().toLowerCase() ?? '';
const cpfDigits = acordo.cliente_cpf?.replace(/\D/g, '') ?? '';
const telDigits = acordo.cliente_telefone?.replace(/\D/g, '') ?? '';

const matchesSearch =
  !termo ||
  nome.includes(termo) ||
  (digitos.length >= 3 && (cpfDigits.includes(digitos) || telDigits.includes(digitos)));
```
- Limite mínimo de 3 dígitos para evitar matches falsos com 1-2 números soltos no CPF/telefone.
- Em `EquipeAcordos.tsx`, manter também o match por `funcionario_nome` (com trim).

### Custo Lovable Cloud
Nenhum impacto — apenas filtragem client-side no array já carregado.


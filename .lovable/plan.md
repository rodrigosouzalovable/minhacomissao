

## Corrigir timeout na busca de Clientes (CNPJ 14 dígitos)

### Diagnóstico

- Tabela `devedores` tem **717.280 linhas ativas** — muito grande.
- Já existe índice `idx_devedores_cpf` sobre `cpf_normalize(cpf)`, mas o código **não o usa**: `cpf.ilike('%45611695000186%')` é uma busca com `%` no início, força *sequential scan* e estoura o `statement_timeout` (8s).
- O `OR(nome.ilike..., cpf.ilike...)` agrava: o planner não consegue usar índice em nenhum dos lados.
- Adicionalmente, o `useEffect fetchCredores` faz paginação 1000-em-1000 sobre todos os 717k registros só para listar credores distintos — também lento e desnecessário.

### Correção

**1. Página `src/pages/Clientes.tsx` — função `handleSearch`**

Quando o termo de busca é puramente numérico (CPF/CNPJ), usar uma **RPC server-side** que faz match exato via índice `cpf_normalize`:

```sql
WHERE cpf_normalize(cpf) = '45611695000186'
```

Para busca por nome (alfanumérica), continuar com `nome.ilike` mas **sem** o OR com cpf — assim o index de texto/scan é coerente.

Detalhe: criar RPC `buscar_devedores_por_documento(p_doc text, p_credor text default null)` que retorna as colunas atuais (`id, nome, cpf, credor, contrato, valor_original, valor_atualizado, estagio, telefone`), filtra `ativo=true` e usa `cpf_normalize(cpf) = p_doc` (igualdade exata, índice funciona) — ou prefix-match se o termo tiver < 11 dígitos.

Lógica nova no front:
- Termo limpo = só dígitos.
- Se `len(termoLimpo) >= 11`: chamar RPC com igualdade exata.
- Se `len(termoLimpo) > 0` mas `< 11`: chamar RPC com prefix match (`LIKE '<digits>%'` sobre `cpf_normalize(cpf)` — também usa o índice).
- Se vazio: usar `nome.ilike` como hoje.

**2. Otimizar `fetchCredores`**

Substituir o loop paginado por uma RPC `listar_credores_distintos()` que faz `SELECT DISTINCT credor FROM devedores WHERE ativo=true AND credor IS NOT NULL` no servidor (1 query, alguns ms). Hoje são ~717 chamadas equivalentes (paginadas) que ocorrem em todo carregamento da página.

**3. Sem mudanças em**
- Lógica de agrupamento por grupo empresarial (front-end)
- Filtro de estágio
- Permissões de credor
- Outras páginas

### Migrações necessárias

- `CREATE OR REPLACE FUNCTION public.buscar_devedores_por_documento(...)` — `SECURITY DEFINER`, `SET search_path = public`, retorna SETOF com as colunas necessárias, respeita filtro de credor.
- `CREATE OR REPLACE FUNCTION public.listar_credores_distintos()` — `SECURITY DEFINER`, retorna `TABLE(credor text)`.
- Ambas com `GRANT EXECUTE ... TO authenticated`.
- Sem nova tabela, sem RLS nova, sem custo adicional de Cloud.

### Resultado esperado

- Busca por CNPJ `45611695000186` (e qualquer CPF/CNPJ) responde em **< 100 ms** em vez de timeout.
- Carregamento inicial da página Clientes fica instantâneo (1 query em vez de centenas).
- Comportamento visível idêntico ao usuário, só mais rápido.


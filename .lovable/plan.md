## Causa

A planilha `ANIBAL.xlsx` traz o nome com **espaço duplo**: `ANIBAL CARDOSO NETO  LTDA`.  
O registro foi importado corretamente (`devedores.id = 6e178f1c...`, credor `MONTREAL`, `ativo=true`), mas a busca em `src/pages/Clientes.tsx` (linha 580) faz:

```
q.ilike('nome', `%${busca.trim()}%`)
```

Como o usuário digitou `ANIBAL CARDOSO NETO L` (com 1 espaço), o `ILIKE` não casa com o nome armazenado (`...NETO  LTDA`, 2 espaços). Resultado: "0 clientes encontrados".

O mesmo problema afeta qualquer planilha importada com espaços duplos, tabs, ou espaços no início/fim — situação comum em arquivos vindos de ERPs.

## Correção

### 1. Tornar a busca tolerante a espaços (frontend + backend)

**`src/pages/Clientes.tsx`** — no `handleSearch`, quando houver termo de busca por nome:
- Quebrar a busca em tokens por espaços (`busca.trim().split(/\s+/)`).
- Aplicar um `ilike` por token (usando `q.ilike('nome', '%token%')` encadeado, que vira `AND`), de forma que a ordem e a quantidade de espaços não atrapalhem.
- Continuar normalizando telefone como já está.

Isso resolve o caso atual sem precisar de migration e cobre quaisquer outras planilhas com espaços extras.

### 2. Normalizar nome no momento da importação

Para evitar que o problema volte e para deixar a base mais limpa:

- Em **`src/pages/ImportarDevedores.tsx`** (e em qualquer função/edge que grave em `devedores.nome`), aplicar `nome.replace(/\s+/g, ' ').trim()` antes do insert.
- Apenas para inserções novas — **não** rodar update em massa nos registros existentes agora (sem custo extra e sem risco de mexer em outros credores).

### 3. Corrigir o registro do ANIBAL já gravado

Atualizar somente esta linha via `supabase--insert` (UPDATE) para colapsar o espaço duplo:

```
UPDATE devedores
SET nome = regexp_replace(trim(nome), '\s+', ' ', 'g')
WHERE id = '6e178f1c-bc85-4107-8016-cecd619353cc';
```

Assim a busca volta a achar o cliente imediatamente, mesmo antes do deploy do fix de UI (que continua valendo para futuras importações).

## Arquivos afetados

- `src/pages/Clientes.tsx` — busca por nome tolerante a espaços/tokens.
- `src/pages/ImportarDevedores.tsx` — normalizar `nome` no insert.
- Update pontual no registro do ANIBAL (sem migration, via insert tool).

## Fora de escopo

- Não vou rodar update em massa em todos os ~devedores antigos (evita risco e custo). A normalização passa a valer dali pra frente; e a busca tolerante cobre os registros legados.
- Sem mudanças em RLS, edge functions ou validação de e-mails.

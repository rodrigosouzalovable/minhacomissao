## Objetivo
No Inbox Meta Massa (`/admin/inbox-meta`), deixar a busca do topo da lista de conversas realmente funcional: encontrar conversa por **nome do contato salvo**, **nome do devedor vinculado (CRM)** ou **telefone** (com ou sem máscara, DDD, +55, etc.), ignorando acentos e maiúsculas.

## O que muda

### 1. `src/pages/InboxMeta.tsx` — função `contatosFiltrados`
Substituir o filtro atual (que só compara `nome` cru + telefone com dígitos) por uma versão robusta:

- Normalizar tanto o termo digitado quanto o alvo usando `.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()` — remove acentos e caixa.
- Detectar se o termo tem dígitos (`/\d/.test(b)`):
  - Se tem dígitos → comparar contra `c.telefone` também normalizado só a dígitos, usando **match por sufixo** (últimos 8 dígitos) além de `includes`, mantendo o padrão de matching de telefone do projeto.
  - Se não tem dígitos → busca somente textual.
- Match textual bate contra:
  - `c.nome` (nome salvo em `meta_whatsapp_contatos`)
  - **novo**: `nomeDevedorPorTelefone[c.telefone]` — mapa carregado a partir da tabela `devedores` (campo `nome` + `telefone` normalizado por sufixo de 8 dígitos), para achar contatos que só têm número salvo.

### 2. `src/pages/InboxMeta.tsx` — carregar nomes do CRM
- Criar um `useEffect` que, sempre que `contatos` mudar, coleta os telefones sem `nome` e faz UM `select nome, telefone from devedores where suffix(telefone) in (...)` (via RPC existente ou query simples usando `ilike` por sufixo, no padrão já usado no projeto).
- Guardar num `useState<Record<string,string>>` (`nomesCRM`) indexado por sufixo de 8 dígitos.
- Exibir esse nome no card da conversa quando `c.nome` estiver vazio (fallback visual), para o usuário conseguir ler quem é.

### 3. Placeholder do input
Trocar `placeholder="Buscar..."` por `placeholder="Buscar por nome ou telefone..."` no `Input` da linha 559.

## Fora do escopo
- Não mexe no Inbox UAZAPI (aba antiga).
- Não altera schema de banco nem cria migrations — só lê `devedores`.
- Não muda ordenação/filtros de etiqueta/lida-não-lida.

## Arquivos afetados
- `src/pages/InboxMeta.tsx` (único)

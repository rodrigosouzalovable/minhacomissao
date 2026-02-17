

## Agrupar CNPJs em Grupo Empresarial (Admin Only)

### Objetivo

Permitir que o administrador selecione multiplos clientes (CNPJs distintos) na pagina /clientes e os agrupe em um "Grupo Empresarial". Ao agrupar, eles aparecerao como uma unica linha na tabela, somando valores e contratos de todos os membros.

### Nova tabela: `grupo_empresarial_membros`

Armazena os vinculos entre CPFs/CNPJs e seus grupos:

```text
grupo_empresarial_membros
- id (uuid, PK)
- grupo_id (uuid) -- identificador do grupo
- nome_grupo (text) -- nome exibido do grupo
- cpf_cnpj (text) -- CPF/CNPJ normalizado que pertence ao grupo
- criado_em (timestamptz)
- criado_por (uuid)
```

Quando dois ou mais CPFs compartilham o mesmo `grupo_id`, sao tratados como um unico grupo. O `nome_grupo` e repetido em cada linha por simplicidade (desnormalizado).

RLS: Somente admins podem INSERT/UPDATE/DELETE. Usuarios autenticados podem SELECT.

### Fluxo na interface (pagina Clientes)

1. Admin ve um botao "Agrupar CNPJs" no topo da tabela de resultados (somente apos pesquisa, somente admin).
2. Ao clicar, a tabela entra em **modo selecao**: checkboxes aparecem em cada linha.
3. Admin seleciona 2+ clientes e clica em "Confirmar Agrupamento".
4. Um dialog aparece pedindo o **nome do grupo** (ex: "POLLYANE DANTAS ALVES").
5. Ao confirmar, os CPFs/CNPJs selecionados sao inseridos na tabela com o mesmo `grupo_id`.
6. Na proxima pesquisa, o `useMemo` de agrupamento verifica se algum CPF pertence a um grupo e consolida todos os membros do grupo em uma unica linha, somando contratos e valores.

### Desagrupar

Um botao "Desagrupar" aparece no dropdown de acoes de linhas agrupadas (badge "Grupo" visivel). Remove todos os registros do grupo do banco.

### Visualizacao da ficha

Quando o usuario clica "Ver Ficha" em um grupo, navega para `/clientes/:id` normalmente. O `DevedorDetalhe` ja carrega contratos pelo CPF -- para grupos, sera necessario carregar contratos de todos os CPFs do grupo. Sera adicionada uma query para buscar membros do grupo pelo CPF do devedor sendo visualizado.

### Modificacoes por arquivo

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Criar tabela `grupo_empresarial_membros` com RLS (admin CRUD, autenticados SELECT) |
| `src/pages/Clientes.tsx` | Importar `useUserRole`; adicionar estados para modo selecao e checkboxes; buscar grupos ao pesquisar; logica de merge no `useMemo`; dialog para nome do grupo; botao desagrupar |
| `src/pages/DevedorDetalhe.tsx` | Ao carregar devedor, verificar se o CPF pertence a um grupo; se sim, buscar contratos e telefones de todos os CPFs do grupo |

### Detalhes tecnicos

**Clientes.tsx - Logica de merge com grupos:**
- Apos buscar resultados, tambem buscar `grupo_empresarial_membros`
- No `useMemo`, primeiro agrupar por CPF (como hoje), depois verificar se algum CPF pertence a um grupo e consolidar todos os membros do mesmo `grupo_id` em uma unica entrada
- A linha agrupada mostra o `nome_grupo`, lista todos os CNPJs, soma contratos e valores

**DevedorDetalhe.tsx - Carregamento expandido:**
- Apos obter o devedor, buscar em `grupo_empresarial_membros` se o CPF normalizado existe
- Se existir, buscar todos os CPFs do mesmo `grupo_id`
- Carregar contratos e telefones de TODOS os CPFs do grupo (nao apenas do CPF atual)

**Seguranca:**
- Botao "Agrupar CNPJs" so renderiza se `isAdmin === true` (via `useUserRole`)
- INSERT/UPDATE/DELETE na tabela protegidos por RLS com `has_role(auth.uid(), 'admin')`


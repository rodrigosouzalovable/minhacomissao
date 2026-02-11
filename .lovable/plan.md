

## Plano: Filtro por Funcionario no Contador de Acordos Hoje

### O que muda

O badge "X acordo(s) hoje" na pagina "Meus Acordos" ganha um seletor de funcionario. Ao selecionar um funcionario, o contador mostra apenas os acordos lancados por aquele funcionario no dia. Por padrao, mostra o total da equipe (comportamento atual).

### Implementacao

#### 1. Nova funcao SQL: `contar_acordos_hoje_por_usuario`

Criar uma funcao `SECURITY DEFINER` que aceita um `user_id` opcional e retorna a contagem de acordos criados hoje, filtrada por usuario quando informado.

```sql
CREATE OR REPLACE FUNCTION public.contar_acordos_hoje_por_usuario(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM acordos
  WHERE criado_em >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo'
    AND (p_user_id IS NULL OR user_id = p_user_id);
$$;
```

#### 2. Atualizar `Acordos.tsx`

- Adicionar estado `selectedUserId` para o funcionario selecionado
- Buscar lista de usuarios (da tabela `user_roles` + `auth.users` metadata, ou usar uma query nos acordos para pegar nomes unicos)
- Trocar a chamada RPC de `contar_acordos_hoje` para `contar_acordos_hoje_por_usuario`, passando o `p_user_id` quando selecionado
- Adicionar um `Select` (dropdown) ao lado do badge, com opcoes:
  - "Todos" (padrao, sem filtro)
  - Lista de funcionarios com nome

#### 3. Buscar lista de funcionarios

Usar uma query nos proprios acordos para extrair os user_ids unicos com seus nomes (via join ou metadata), ou criar uma query simples que busque os usuarios que ja lancaram acordos. A abordagem mais simples: buscar direto da tabela `acordos` os `user_id` distintos e cruzar com a tabela de perfis ou user metadata.

Como o sistema ja tem usuarios na tabela `auth.users` com `raw_user_meta_data->>'nome'`, vou criar uma funcao `SECURITY DEFINER` para listar os funcionarios disponiveis.

```sql
CREATE OR REPLACE FUNCTION public.listar_funcionarios()
RETURNS TABLE(user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT a.user_id, 
    COALESCE(u.raw_user_meta_data->>'nome', u.email) as nome
  FROM acordos a
  JOIN auth.users u ON u.id = a.user_id
  ORDER BY nome;
$$;
```

### Layout da UI

O badge atual sera expandido para incluir um dropdown compacto:

```
[Meus Acordos]  [Todos v]  [~ 28 acordo(s) hoje]
```

Ao selecionar um funcionario no dropdown, o contador atualiza automaticamente.

### Detalhes Tecnicos

**Arquivos modificados:**
- Nova migracao SQL (2 funcoes: `contar_acordos_hoje_por_usuario` e `listar_funcionarios`)
- `src/pages/Acordos.tsx` -- adicionar dropdown de funcionario e atualizar query do contador

**Dependencias:** Nenhuma nova dependencia necessaria. Usa componentes `Select` e `Badge` ja existentes.


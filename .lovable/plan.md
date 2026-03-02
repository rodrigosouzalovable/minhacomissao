

## Diagnóstico

O cliente JOZY ALVES DE SOUZA CRUZ LEMES não aparece porque suas permissões de usuário filtram os credores visíveis. O sistema usa a tabela `user_permissions` com a coluna `credores` (padrão: `['ume_novo_mundo']`). Na página Clientes, o código filtra os credores exibidos com base nessa lista de permissões (linhas 122-124 de `Clientes.tsx`).

O credor "MONTREAL" tem o slug `montreal` no mapeamento `CREDOR_SLUG_MAP`. Como esse slug não está nas suas permissões, os clientes desse credor são filtrados.

## Solução

Executar um UPDATE na tabela `user_permissions` para adicionar `montreal` à lista de credores do usuário Rodrigo Ribeiro de Souza (`user_id = ee649720-b8ce-47a2-859e-100a3a9ae6bb`):

```sql
UPDATE user_permissions 
SET credores = array_append(credores, 'montreal')
WHERE user_id = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'
  AND NOT ('montreal' = ANY(credores));
```

Nenhuma alteração de código é necessária — apenas a atualização dos dados de permissão no banco.


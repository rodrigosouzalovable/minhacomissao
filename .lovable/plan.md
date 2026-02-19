
## Atualizar dialog de Editar Permissoes

### Alteracoes no arquivo `src/components/EditPermissionsDialog.tsx`

**1. Adicionar aba "Clientes" na lista de abas disponiveis**

A aba `/clientes` (Clientes) existe no menu lateral mas nao aparece no dialog de permissoes. Sera adicionada ao array `AVAILABLE_TABS`:

```
{ path: '/clientes', label: 'Clientes' }
```

Lista completa apos a alteracao:
- Minha Conta
- Dashboard
- Meus Acordos
- Novo Acordo
- Retornos
- Clientes (nova)
- Minhas Comissoes

**2. Adicionar credor MONTREAL na lista de empresas**

Sera adicionada uma nova opcao ao array `EMPRESAS`:

```
{ value: 'montreal', label: 'MONTREAL' }
```

Lista completa apos a alteracao:
- UME / NOVO MUNDO
- MUNDO DA MODA
- MONTREAL (nova)

Nenhuma alteracao de banco de dados e necessaria, pois o campo `empresa` na tabela `user_permissions` e do tipo texto livre.

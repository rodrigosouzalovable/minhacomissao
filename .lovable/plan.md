

## Adicionar Editar/Excluir no telefone importado

Atualmente, o telefone importado aparece como uma linha virtual (sem registro real no banco) e nao possui acoes. O usuario quer que ele tenha as mesmas opcoes dos demais telefones.

### Abordagem

Em vez de tratar o telefone importado como item somente-leitura, vamos adicionar ao dropdown dele duas acoes especiais:

1. **Editar**: Abre o dialog `TelefoneDialog` pre-preenchido com o numero importado, permitindo ao usuario salvar como um registro real na tabela `devedor_telefones`. Apos salvar, o telefone deixa de aparecer como "Importado" e passa a ser um registro normal editavel.

2. **Excluir**: Limpa o campo `telefone` do registro `devedores` (seta para `null`), removendo o telefone importado da lista.

### Modificacoes

**`src/components/devedor/TelefoneTab.tsx`**:
- Remover a condicao `!isImportado` que oculta o dropdown de acoes
- Para o item importado, exibir no dropdown:
  - "Salvar como telefone" - abre o TelefoneDialog pre-preenchido com o numero
  - "Excluir" - chama uma funcao para limpar o telefone do devedor
- Adicionar prop `devedorId` (string) para identificar o registro do devedor
- Adicionar funcao `handleExcluirImportado` que faz UPDATE em `devedores` setando `telefone = null`
- Modificar o `TelefoneDialog` para aceitar um valor inicial opcional (`initialNumero`)

**`src/components/devedor/TelefoneDialog.tsx`**:
- Adicionar prop opcional `initialNumero?: string` 
- Quando `initialNumero` for fornecido, pre-preencher o campo de numero ao abrir o dialog

**`src/pages/DevedorDetalhe.tsx`**:
- Passar o `devedorId` (ou o primeiro devedor do grupo) como prop para `TelefoneTab`

### Detalhes tecnicos

| Arquivo | Alteracao |
|---|---|
| `src/components/devedor/TelefoneTab.tsx` | Adicionar dropdown no item importado com "Salvar como telefone" e "Excluir"; adicionar prop `devedorId`; funcao para limpar telefone do devedor |
| `src/components/devedor/TelefoneDialog.tsx` | Adicionar prop `initialNumero` para pre-preencher o numero |
| `src/pages/DevedorDetalhe.tsx` | Passar `devedorId` para o `TelefoneTab` |

Nenhuma migracao de banco necessaria -- a tabela `devedores` ja permite UPDATE para admins e o campo `telefone` ja e nullable.

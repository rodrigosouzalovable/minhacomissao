

## Historico de Importacoes com opcao de exclusao

### Resumo
Criar um sistema para registrar cada importacao de planilha no banco de dados, exibir o historico na pagina de importacao, e permitir apagar uma importacao (o que remove todos os devedores associados).

### Alteracoes no banco de dados

**Nova tabela: `importacoes`**

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador unico |
| nome_arquivo | text | Nome do arquivo importado |
| credor | text | Credor/layout utilizado |
| total_registros | integer | Quantidade de registros importados |
| importado_por | uuid | ID do usuario que importou |
| criado_em | timestamptz | Data/hora da importacao |

RLS: somente admins podem gerenciar (ALL). Usuarios autenticados podem ver (SELECT).

**Alteracao na tabela `devedores`**

Adicionar coluna `importacao_id` (uuid, nullable, FK para `importacoes.id` com ON DELETE CASCADE). Isso garante que ao apagar uma importacao, todos os devedores vinculados sao removidos automaticamente.

### Alteracoes no frontend

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. No `handleImport`:
   - Primeiro inserir um registro na tabela `importacoes` com nome_arquivo, credor, total_registros, importado_por
   - Usar o `id` retornado para preencher `importacao_id` em cada registro de devedor

2. Adicionar secao "Historico de Importacoes" abaixo do formulario de upload:
   - Carregar dados da tabela `importacoes` ordenados por data (mais recente primeiro)
   - Exibir em tabela: Nome do Arquivo, Credor, Qtd Registros, Data, botao Excluir
   - Carregar ao montar o componente e apos cada importacao

3. Botao "Excluir" em cada linha:
   - Exibir dialogo de confirmacao (AlertDialog) antes de apagar
   - Ao confirmar, deletar o registro da tabela `importacoes` (o CASCADE remove os devedores automaticamente)
   - Atualizar a lista apos exclusao

### Fluxo do usuario

1. Usuario seleciona credor e faz upload da planilha
2. Confirma importacao - sistema salva na tabela `importacoes` e nos `devedores` com vinculo
3. Abaixo do formulario, ve o historico de todas as planilhas importadas
4. Pode clicar em "Excluir" em qualquer importacao passada
5. Sistema pede confirmacao e, ao confirmar, remove a importacao e todos os clientes associados


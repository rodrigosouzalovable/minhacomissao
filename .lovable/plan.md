# Renomear caixa pelo admin da caixa (Parceiro Meta)

## Hoje
- Ninguém consegue renomear uma caixa pela tela "Caixas de mensagens"; só existe criar, acesso e excluir.
- Pelo banco, só o dono da caixa ou o admin global pode alterar uma caixa.

## O que será feito
1. Na lista de caixas, um ícone de lápis ao lado do nome permite editar o nome da caixa (com salvar/cancelar).
2. Quem vê o lápis: admin global, dono da caixa, e usuário com **Parceiro Meta** marcado como **admin daquela caixa**.
3. O admin da caixa só renomeia as caixas dele; não pode excluir, trocar dono nem mexer em outras caixas.
4. Nome obrigatório, até 60 caracteres; aviso claro se a alteração for recusada.

## Detalhes técnicos
- Função `can_rename_meta_inbox_folder(uid, folder_id)` (SECURITY DEFINER): `parceiro_meta = true` em `user_permissions` e `admin = true` em `meta_inbox_folder_members` para a caixa.
- Nova política UPDATE em `meta_inbox_folders` usando essa função, com trigger impedindo que não-donos/não-admins alterem colunas além de `nome` (owner_id, cor fixos).
- `MetaFoldersDialog.tsx`: edição inline do nome; carregar `parceiroMeta` via `useUserPermissions`; tratar 0 linhas atualizadas como erro.
- Sem custo novo.

# Renomear caixa pelo menu "Configurar caixa" + exclusão de instância do Thiago

## 1. Renomear caixa
- Remover o lápis da lista de caixas.
- Clique com o botão direito na caixa → **Configurar caixa** → novo campo **Nome da caixa** no topo, com botão Salvar.
- Quem pode: admin global, dono da caixa ou quem é **admin daquela caixa** — sem exigir Parceiro Meta.
- O admin da caixa só altera o nome (não exclui, não troca cor nem dono). A caixa Padrão não tem nome editável.
- Ao salvar, o nome muda na hora na lista de caixas.

## 2. Exclusão de instância (API Oficial Meta)
- Hoje a tela mostra "Instância excluída" sem conferir se o banco realmente apagou; qualquer recusa fica escondida.
- Ajustar para só mostrar sucesso quando a instância sumir de fato; caso contrário, mostrar o motivo real.
- Investigar a causa com as instâncias do Thiago: suspeita principal é um vínculo com a recuperação cadastral que impede a exclusão (ou regra de acesso). Corrigir a causa confirmada, preservando históricos (mensagens, envios e acordos ficam sem a instância, não são apagados).

## Detalhes técnicos
- Migração: `can_rename_meta_inbox_folder` passa a checar apenas `meta_inbox_folder_members.admin = true` (remove `parceiro_meta`); trigger de guarda mantido.
- `MetaFoldersDialog.tsx`: remover edição inline/lápis e `useUserPermissions`.
- `MetaFolderConfigDialog.tsx`: campo de nome quando `folderId` não for nulo; update com `.select('id')`, 0 linhas = erro; callback para recarregar as caixas em `InboxMeta.tsx`.
- `ConfigurarMeta.tsx` `excluir`: `.delete().eq('id').select('id')`, tratar `error` e 0 linhas.
- FK `meta_recuperacao_cadastral_destinos` (NO ACTION) → se confirmada como bloqueio, trocar para `ON DELETE SET NULL`/`CASCADE` conforme a coluna permitir; reproduzir a exclusão como o usuário do Thiago dentro de transação com rollback para confirmar.

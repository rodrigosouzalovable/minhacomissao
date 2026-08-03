# Acesso por caixa de mensagens no Inbox Meta Oficial

## Objetivo

Clique com o botão direito em qualquer aba de caixa (Padrão, AQUECIMENTO, FESTA PREMIUM, ...) abre um diálogo com todos os usuários do sistema. Somente os usuários marcados enxergam aquela caixa.

## Regras acordadas

- A caixa **Padrão** também passa a ter lista própria de atendentes.
- Usuário não selecionado em nenhuma caixa não vê nenhuma caixa (Inbox Meta fica vazio, com aviso "Sem caixa de mensagens atribuída — fale com o administrador").
- Admin sempre vê e gerencia todas as caixas.
- Para não bloquear ninguém de surpresa, todos os usuários ativos hoje entram marcados na caixa Padrão; as caixas já criadas mantêm os acessos atuais.

## O que será feito

### 1. Menu de contexto nas abas das caixas

- Clique direito em qualquer chip de caixa (incluindo Padrão) abre item "Atendentes desta caixa".
- Só admin (e o dono da caixa) vê essa opção; para os demais o clique direito não faz nada.

### 2. Diálogo "Atendentes da caixa X"

- Lista todos os usuários do sistema com checkbox e busca por nome.
- Ações rápidas: marcar todos / desmarcar todos.
- Salva na hora; contador de selecionados no título.
- Aviso ao desmarcar o próprio usuário admin (ele continua vendo por ser admin).

### 3. Filtragem das abas

- As abas exibidas passam a ser só as caixas em que o usuário está atribuído.
- Se a caixa ativa deixar de ser permitida, o app cai automaticamente na primeira caixa permitida.
- Sem nenhuma caixa permitida: nenhuma aba, lista vazia com o aviso acima.

### 4. Bloqueio real no banco (não só na tela)

Além de esconder as abas, as conversas de uma caixa passam a ser legíveis apenas por quem tem acesso àquela caixa — inclusive a caixa Padrão. Assim, busca, notificações e acesso direto não vazam conversas de outra caixa.

## Detalhes técnicos

- Banco: a caixa Padrão ganha representação de membros. Nova tabela `meta_inbox_default_members (user_id uuid pk)` com GRANTs (`authenticated` select, `service_role` all), RLS: select próprio + `has_role(admin)` para gerenciar. Backfill com todos os `profiles.user_id` atuais.
- Nova função `public.can_access_meta_inbox_default(_uid uuid)` (security definer) e ajuste de `can_access_meta_folder` para uso nas policies.
- `meta_whatsapp_contatos`: as policies permissivas atuais (`meta_contatos_owner_or_admin_all`, `meta_contatos_shared_select`, `tenant_scope_all`) hoje anulam por OR a restrição de pasta. Serão consolidadas para que a checagem de caixa seja **restritiva** (`AS RESTRICTIVE`): `is_admin_user(auth.uid()) OR (folder_id IS NULL AND can_access_meta_inbox_default(auth.uid())) OR can_access_meta_folder(auth.uid(), folder_id)`. Mesma policy restritiva aplicada a `meta_whatsapp_mensagens` via contato.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx` (novo): lista de usuários via RPC `listar_funcionarios`, grava em `meta_inbox_folder_members` ou `meta_inbox_default_members` quando `folderId === null`.
- `src/pages/InboxMeta.tsx`: envolver cada chip de caixa em `ContextMenu` (shadcn) com o item de acesso; `fetchFolders` passa a carregar também os membros da Padrão para decidir se o chip "Padrão" aparece; guard para realinhar `currentFolderId`.
- `MetaFoldersDialog.tsx`: reaproveita o novo diálogo de acesso no lugar do bloco inline "Acesso (n)", evitando duas implementações.
- Webhook `meta-whatsapp-webhook` e demais funções usam service role, sem impacto.

## Sino de notificações no Inbox Meta Oficial + rodízio de consultas CPF

### Fluxo
1. Consulta no portal público (edge fn `notify-cpf-consulta`) → grava um registro em nova tabela e escolhe um funcionário do rodízio.
2. O funcionário escolhido vê a notificação em tempo real no sino do cabeçalho da aba **Inbox Meta Oficial**.
3. Uma cópia da notificação continua indo pelo WhatsApp para o admin (fallback), como já ocorre hoje.

### 1. Nova permissão por usuário
Em `user_permissions` (tabela já usada pelo `EditPermissionsDialog`), adicionar coluna:
- `recebe_consulta_cpf boolean not null default false`

Interface (arquivo `src/components/EditPermissionsDialog.tsx`): adicionar um switch **"Receber notificações de consulta de CPF (rodízio)"** junto às demais permissões, para o admin escolher quais logins participam do pool.

### 2. Nova tabela `consulta_cpf_notificacoes`
Colunas de domínio:
- `cpf`, `nome`, `credor`, `total_debitos`, `telefones`
- `assigned_user_id` (uuid → auth.users)
- `lida_em` (timestamp nullable)

Índices: `(assigned_user_id, created_at desc)`, `(assigned_user_id, lida_em)`.
GRANTs: `authenticated` (SELECT/UPDATE), `service_role` (ALL).
RLS: usuário só vê/atualiza suas próprias linhas (`assigned_user_id = auth.uid()`); admin pode ver todas via `has_role(auth.uid(),'admin')`. Só edge functions inserem (nenhuma policy de INSERT para authenticated).
Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.consulta_cpf_notificacoes`.

### 3. Edge function `notify-cpf-consulta`
Manter o envio WhatsApp atual (`notificarAdmin`) como fallback. Adicionar antes do return:
1. Buscar `user_id` em `user_permissions WHERE recebe_consulta_cpf = true`.
2. Se pool vazio: só WhatsApp; retorna normal.
3. Se pool com N usuários, escolher o próximo por **rodízio real**:
   - Ordenar por `(SELECT max(created_at) FROM consulta_cpf_notificacoes WHERE assigned_user_id = u.user_id) NULLS FIRST, user_id`.
   - O primeiro da lista é o próximo a receber.
4. Inserir uma linha em `consulta_cpf_notificacoes` com dados da consulta e `assigned_user_id`.

### 4. Sino no cabeçalho do Inbox Meta Oficial
Novo componente `src/components/inbox/meta/NotificacoesCpfBell.tsx`:
- Ícone `Bell` do lucide com badge do total de `lida_em IS NULL` do usuário.
- Popover ao clicar, mostrando as últimas 20 notificações:
  - CPF formatado, nome, credor, débitos, telefones, data/hora relativa.
  - Não lidas em destaque; lidas apagadas.
  - Botão "Marcar como lida" por item + "Marcar todas como lidas".
- Fetch inicial via Supabase (`.eq('assigned_user_id', user.id)`).
- Realtime `postgres_changes` filtrado por `assigned_user_id=eq.<user.id>` — dentro de `useEffect`, com cleanup (`removeChannel`) no unmount.

Integração em `src/pages/InboxMeta.tsx` (linha ~621, dentro do header do sidebar): inserir `<NotificacoesCpfBell />` entre o título "Inbox API Oficial Meta" e o botão de tema — visível para todos os usuários da página.

### Fora de escopo
- Nada muda em outros usos de `notificar-admin` (aquecimento, boletos, etc.).
- Não há nova página; a interface é apenas o sino dentro do Inbox Meta Oficial.
- O WhatsApp do admin continua recebendo — fallback preservado.

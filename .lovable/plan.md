
## 1. Remover RODRIGO do rodízio de atendentes

O rodízio em `meta-whatsapp-webhook` pega automaticamente **toda** etiqueta com nome começando por `Atendente:` do dono da instância. Enquanto existir a etiqueta `Atendente: RODRIGO`, novos contatos podem cair pra ela.

Ação: apagar a etiqueta `Atendente: RODRIGO` (e os vínculos com contatos que já ficaram marcados com ela). A partir daí, o rodízio distribuirá apenas entre Anna Flavia, Fernanda, Wallace e Yasmim.

- Remover linhas em `meta_whatsapp_contato_etiquetas` onde `etiqueta_id` pertence a etiquetas com `nome ilike 'Atendente: RODRIGO%'`.
- Apagar a(s) etiqueta(s) `Atendente: RODRIGO` da tabela `meta_whatsapp_etiquetas`.

Observação: contatos que já estavam marcados com "Atendente: RODRIGO" perdem essa etiqueta e voltam para "sem atendente" — o próximo webhook de entrada os reatribui automaticamente pelo rodízio (menor carga). Se preferir manter os antigos com Rodrigo e apenas parar de receber novos, me avisa que faço variação.

## 2. Permissões de abas realmente escondem as abas (menos "Usuários")

Hoje o `AppLayout` faz `if (isAdmin) return true`, ou seja, admin **sempre** vê todas as abas — as checkboxes do dialog não têm efeito no próprio admin. E o dialog permite desmarcar qualquer aba, inclusive Usuários (o que trancaria o admin fora do painel).

Mudanças:

**`src/components/layout/AppLayout.tsx`**
- Trocar a lógica de filtro para respeitar `abasPermitidas` também para admin. Regra final:
  - `/admin/usuarios` sempre visível (fail-safe).
  - Se existir `abasPermitidas`, mostrar somente as abas listadas + `/admin/usuarios`.
  - Se não existir (usuário sem registro em `user_permissions`), manter comportamento atual: admin vê tudo; funcionário/gestor vê o que já via.

**`src/components/EditPermissionsDialog.tsx`**
- A checkbox de `/admin/usuarios` fica sempre marcada, `disabled`, com hint "Não pode ser desabilitada".
- Ao salvar, garantir que `/admin/usuarios` esteja sempre em `abas_permitidas` (mesmo que o valor no estado tenha sido manipulado).
- Ao inicializar (sem `permissions` prévias) já inclui `/admin/usuarios`.

Nenhuma migração de schema é necessária — a coluna `abas_permitidas` já existe.

## Verificação
- Após salvar permissões desmarcando "Dashboard" para o próprio login, a aba some da sidebar; ao remarcar e salvar, volta.
- "Usuários" continua visível independente do estado das outras checkboxes.
- Depois da limpeza, uma nova mensagem de entrada em uma conversa nova não recebe mais a etiqueta `Atendente: RODRIGO`.

Posso seguir?

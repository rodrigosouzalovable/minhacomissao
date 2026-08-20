# Ligação recebida em qualquer aba do sistema

Objetivo: quando o cliente ligar, o pop-up de chamada aparece em qualquer tela do Meus Acordos (Acordos, Dashboard, Envio Meta, etc.), tocando **somente** para o atendente da etiqueta vinculada à conversa.

## Situação atual (verificada)

- O provedor de chamadas (`MetaCallProvider`) já envolve todas as rotas em `src/App.tsx`, e o pop-up de chamada recebida é renderizado por ele — ou seja, a estrutura global existe.
- O toque só acontece quando a chamada gravada no banco tem `funcionario_id` igual ao usuário logado.
- Pontos frágeis encontrados no registro da chamada (`meta-whatsapp-webhook`):
  - o atendente (`funcionario_id`) é definido **apenas na criação** da chamada; se a linha já existir (evento `connect` antes do `ringing`), ela pode continuar sem atendente e ninguém recebe o toque;
  - a conversa é localizada por telefone **exato**, e não pelo padrão do sistema (últimos 8 dígitos), então chamadas de clientes com formatação diferente ficam sem conversa vinculada e, por consequência, sem atendente;
  - quando o atendente não é identificado, a chamada não toca para ninguém.

## O que será feito

1. **Sempre identificar o atendente ao tocar**: no webhook, quando o evento for `ringing`/`connect` de entrada e a chamada ainda não tiver atendente definido, resolver a etiqueta do atendente naquele momento e gravar no registro (inclusive em atualizações de linhas já existentes).
2. **Vincular a conversa pelo sufixo do telefone** (últimos 8 dígitos), mantendo o padrão já usado no resto do sistema, para não perder o vínculo por diferença de formatação.
3. **Rede de segurança**: se, mesmo assim, nenhum atendente for identificado, a chamada toca para os administradores (para que nunca fique uma ligação sem ninguém atendendo). Continua valendo: se houver etiqueta de atendente, toca só para essa pessoa; se estiver com o IAGO, a conversa é transferida para o próximo do rodízio antes de tocar.
4. **Pop-up global mais completo**: garantir que o aviso de chamada recebida apareça acima de qualquer tela (inclusive sobre outros diálogos abertos) e incluir no pop-up o nome/telefone do cliente e um botão "Abrir conversa", para que o atendente possa atender de qualquer aba e ir direto ao histórico no Inbox.
5. **Reforço na entrega em tempo real**: reconectar automaticamente a escuta de chamadas quando a aba volta ao foco ou a conexão cai, evitando perder um toque por conexão inativa.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: no bloco de eventos `calls`, buscar contato por `like '%<sufixo8>'`, chamar `resolverAtendenteChamada` também no caminho de `update` quando `funcionario_id` estiver nulo e o status for `ringing`, e aplicar fallback para admins (`user_roles` = admin) quando o resultado for nulo.
- `supabase/functions/_shared/meta-call-atendente.ts`: retornar também a lista de admins como fallback (novo helper), sem alterar a regra da etiqueta/rodízio.
- `src/contexts/MetaCallContext.tsx`: aceitar toque quando `funcionario_id` é do usuário **ou** quando a chamada estiver marcada como fallback de admin e o usuário for admin; adicionar reassinatura do canal Realtime em `visibilitychange`/erro de canal.
- `src/components/inbox/meta/ChamadaEntrandoDialog.tsx`: exibir nome do contato (busca pelo `contato_id`/telefone) e botão "Abrir conversa" navegando para `/admin/inbox-meta?contato=...&telefone=...&instancia=...`; z-index elevado.
- Deploy da função `meta-whatsapp-webhook` após as alterações.

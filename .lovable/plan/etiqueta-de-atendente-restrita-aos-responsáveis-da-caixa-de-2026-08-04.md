# Etiqueta de atendente restrita aos responsáveis da caixa de mensagens

## Situação atual (verificada no código)

No webhook do Inbox Meta (`meta-whatsapp-webhook`):

- A etiqueta automática de atendente só é aplicada quando o contato está na caixa **Padrão** (`folder_id IS NULL`). Conversas em caixas como FESTA PREMIUM ou AMARAL não recebem etiqueta automática.
- Quando é aplicada, a elegibilidade considera apenas a permissão global "Atende no Inbox Meta Oficial" (`user_permissions.atende_inbox_meta`) — **não** considera quem foi selecionado como responsável da caixa.
- Resultado: aparecem etiquetas de atendentes que não são responsáveis pela caixa daquela conversa, e o rodízio pode escolher qualquer atendente ativo do sistema.

## O que será feito

1. **Elegibilidade por caixa de mensagens**
   - Ao receber uma resposta do cliente, o sistema descobre a caixa da conversa (`folder_id`) e monta a lista de atendentes permitidos a partir dos responsáveis daquela caixa:
     - caixa criada → membros da caixa;
     - caixa Padrão → membros da caixa Padrão.
   - Admins que também sejam membros continuam na lista; quem não é responsável da caixa nunca recebe a etiqueta.
   - A permissão global "Atende no Inbox Meta Oficial" continua valendo como segundo filtro (precisa das duas coisas).

2. **Etiquetagem passa a funcionar em todas as caixas**
   - Remover a trava que só etiqueta a caixa Padrão. Conversas em FESTA PREMIUM, AMARAL, etc. passam a receber etiqueta — sempre restrita aos responsáveis daquela caixa.

3. **Aplicar o filtro em todos os caminhos de atribuição**
   - Match por acordo lançado, match por consulta no portal, match por "quem iniciou a conversa" e rodízio por menor carga: todos passam pelo mesmo filtro de responsáveis da caixa.
   - Se o atendente encontrado (por acordo/portal/iniciou) não for responsável da caixa, o sistema não aplica aquela etiqueta e cai no rodízio entre os responsáveis da caixa. Se a caixa não tiver nenhum responsável elegível, nenhuma etiqueta é aplicada (registrado no log).

4. **Menu de contexto (troca manual)**
   - Na lista de atendentes oferecida ao clicar com o botão direito numa conversa, mostrar apenas os atendentes responsáveis pela caixa atual, para não recriar manualmente o problema.

## Fora do escopo

- Não altera etiquetas já existentes nas conversas antigas. Se quiser, posso rodar depois uma limpeza das etiquetas de atendente que não pertencem à caixa da conversa.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: após obter `_folderIdContato`, buscar `meta_inbox_folder_members` (quando `folder_id` não nulo) ou `meta_inbox_default_members` (quando nulo) e montar um `Set<user_id>` permitido. `etiquetaElegivel(nome)` passa a exigir `nomeElegivel.get(nome) && permitidosCaixa.has(userIdPorNome.get(nome))`. Remover a condição `_folderIdContato === null` do `if` que abre o bloco de etiquetagem.
- Todos os matches (acordo, consulta portal, remetente) já chamam `etiquetaElegivel`, então herdam o filtro; o rodízio usa `atendentesRodizio`, também derivado dele.
- `supabase/functions/send-whatsapp-meta/index.ts`: no trecho `origem: 'auto_atendente'`, validar que o remetente é membro da caixa do contato antes de inserir a etiqueta.
- `src/components/inbox/meta/MetaConversaContextMenu.tsx`: filtrar as opções de atendente pelos membros da caixa da conversa (mesma lógica de `folder_id`).

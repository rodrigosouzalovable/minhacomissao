# Chamadas: aviso com atalho, toque só para o atendente da conversa e bip que para

## O que muda

### 1. Aviso "Cliente autorizou a chamada" com botão de ação
Hoje o aviso só informa o texto, sem dizer quem é o cliente. Passa a mostrar o número (e o nome do contato, quando existir) e um botão "Abrir conversa" que leva direto ao Inbox Meta Oficial na conversa daquele cliente, com o botão de telefone já liberado para discar.

### 2. A ligação toca apenas para o atendente vinculado à conversa
- Ao chegar uma chamada de entrada, o sistema descobre o atendente da conversa pela etiqueta "Atendente: <nome>" do contato.
- O pop-up de chamada e o bip aparecem somente na tela desse atendente. Ninguém mais recebe o toque (nem admin).
- Se a conversa não tiver etiqueta de atendente, ela entra no rodízio da caixa na hora da ligação e toca para quem foi sorteado.

### 3. Conversa com o IAGO: transferência definitiva antes de tocar
Se a conversa estiver etiquetada com o IAGO quando a ligação chegar, o sistema remove a etiqueta do IAGO, atribui o próximo atendente humano do rodízio da caixa (transferência definitiva — passa a valer também para o chat) e só então o toque cai para essa pessoa.

### 4. O bip para quando a ligação é recusada
- Recusa feita por você: o toque é interrompido imediatamente, antes de enviar a recusa à Meta.
- Recusa/desistência do lado do cliente: o áudio é cortado assim que o status muda, sem depender do fechamento do pop-up.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts` (bloco `calls`): ao criar/atualizar a chamada de entrada com status `ringing`, resolver o atendente:
  1. lê etiquetas `Atendente:%` do contato;
  2. se for a etiqueta do IAGO (mesma detecção usada em `iago-plantao-devolver`), apaga essa etiqueta e chama `atribuir_atendente_rodizio(p_contato_id)`, registrando a troca;
  3. se não houver etiqueta, chama `atribuir_atendente_rodizio`;
  4. grava o `user_id` correspondente (etiqueta → `profiles.nome`) em `whatsapp_chamadas.funcionario_id` (coluna já existente).
- `src/contexts/MetaCallContext.tsx`:
  - o handler Realtime de `whatsapp_chamadas` só abre o pop-up quando `row.funcionario_id === auth.uid()`;
  - `rejeitar` fecha o pop-up/toque antes do `invoke`;
  - no aviso de permissão aceita, incluir botão de ação (`toast` com `action`) navegando para `/admin/inbox-meta?contato=<id>&telefone=<tel>`; o nome vem de `meta_whatsapp_contatos`.
- `src/pages/InboxMeta.tsx`: ler `contato`/`telefone` da query string e selecionar automaticamente essa conversa (buscando o contato mesmo fora da página atual da lista), limpando o parâmetro depois.
- `src/components/inbox/meta/ChamadaEntrandoDialog.tsx`: parar oscilador/`AudioContext` imediatamente ao clicar em Rejeitar.
- Sem novas tabelas, crons, polling ou canais Realtime — custo de backend inalterado.

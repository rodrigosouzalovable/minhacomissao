# Bloquear chamadas de um cliente no Inbox Meta Oficial

## O que muda
- No cabeçalho da conversa, ao lado do botão de ligar, entra um novo ícone de telefone riscado: **Bloquear chamadas deste cliente**.
- Ao clicar, pede confirmação e marca o cliente como bloqueado para chamadas. O ícone fica destacado (vermelho) e o texto passa a ser **Desbloquear chamadas**.
- Quando um cliente bloqueado liga:
  - a chamada é recusada automaticamente;
  - não aparece a tela de "chamada recebida" e não toca para nenhum atendente;
  - a chamada fica no histórico como "Bloqueada".
- Mensagens continuam normais: o bloqueio vale só para ligações.
- O bloqueio vale para o número do cliente em todas as instâncias, pelos últimos 8 dígitos.
- Qualquer usuário com acesso à conversa pode bloquear ou desbloquear.

## Detalhes técnicos
- Nova tabela `meta_chamadas_bloqueadas` com: sufixo de 8 dígitos (único), telefone, quem bloqueou e data. Haverá RLS para usuários autenticados com acesso ao Inbox, além das permissões de acesso necessárias.
- `InboxMeta.tsx`: ícone `PhoneOff` no cabeçalho. O estado é lido uma vez, ao abrir a conversa, por consulta indexada. Não haverá atualização periódica nem canal em tempo real.
- `meta-whatsapp-webhook` (evento `calls`, entrada `connect`/`ringing`): antes de registrar, consulta o sufixo na tabela. Se estiver bloqueado, chama a Graph API com `action: reject`, grava a chamada com status `bloqueada` e sem atendente, e não segue o fluxo normal de toque.
- O front-end ignora chamadas com status `bloqueada` no alerta de chamada recebida.
- Custo: uma consulta indexada por chamada recebida, desprezível. Não cria agendamentos, consultas periódicas nem canais em tempo real.

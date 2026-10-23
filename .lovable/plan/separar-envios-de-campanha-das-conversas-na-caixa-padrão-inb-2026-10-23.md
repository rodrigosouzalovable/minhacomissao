# Separar envios de campanha das conversas na caixa PADRÃO (Inbox Meta)

## O que muda para você
- Na caixa **PADRÃO**, a lista principal passa a mostrar só conversas em que o cliente **já respondeu** pelo menos uma vez.
- Uma nova aba **"Envios de campanha"** (ao lado de Todas / Não lidas) mostra os clientes que receberam campanha e **ainda não responderam**.
- Quando o cliente responde, a conversa sai automaticamente de "Envios de campanha" e entra na lista principal — e **nunca mais volta**, mesmo que você envie novas campanhas para ele.
- Vale **somente para o seu login** e **somente na caixa PADRÃO**. Outras caixas e outros usuários continuam como hoje.
- A busca por nome/telefone continua encontrando qualquer conversa, nas duas listas (com um selo "Envio de campanha" quando for o caso).
- Contadores: a aba mostra a quantidade de envios sem resposta.

## Regras preservadas
- Nada é apagado nem movido de caixa; histórico, etiquetas e retenção de 3 dias continuam iguais.
- Conversas fixadas aparecem na lista principal mesmo sem resposta.
- Não lido, rodízio de atendentes e IAGO não mudam.

## Detalhes técnicos
- Critério: o campo de "última mensagem recebida do cliente" do contato. Ele só é preenchido quando o cliente escreve e nunca é limpo, garantindo o "não sai mais".
  - Lista principal (PADRÃO, seu login): `ultima_msg_entrada_em IS NOT NULL OR fixado = true`.
  - Aba Envios de campanha: `ultima_msg_entrada_em IS NULL AND fixado = false`.
- Filtro aplicado na consulta ao banco (antes da paginação), em `src/pages/InboxMeta.tsx`, junto ao filtro atual de `folder_id IS NULL`; o atualizado em tempo real move o card de uma lista para a outra quando chega a resposta.
- Ativação restrita ao seu usuário (admin dono da PADRÃO) via verificação do usuário logado.
- Índice parcial em `meta_whatsapp_contatos (instancia_id, ultima_mensagem_em) WHERE folder_id IS NULL` com a condição de entrada, para manter a lista rápida.
- Sem custo novo: nenhum agendamento, polling ou canal em tempo real adicional.
- Teste: contato sem resposta aparece só na aba de campanha; após resposta, só na lista principal; nova campanha não o devolve.

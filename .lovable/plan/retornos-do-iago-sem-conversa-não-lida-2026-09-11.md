# Retornos do IAGO sem conversa não lida

## Objetivo
Quando o IAGO enviar uma mensagem automática de retorno ao cliente, o card da conversa ficará como lido no Inbox Meta Oficial. Uma nova mensagem recebida do cliente continuará marcando a conversa como não lida normalmente.

## Situação confirmada
- O retorno do IAGO é enviado por `iago-followup-tick` e gravado como mensagem de saída.
- O envio atualiza a última mensagem e o horário do card, mas não limpa `nao_lido`.
- Há conversas reais em que a última mensagem é um follow-up de saída do IAGO e o card ainda mantém `nao_lido > 0` da mensagem anterior do cliente.

## Alteração
- Após cada follow-up enviado com sucesso, marcar somente aquela conversa como lida (`nao_lido = 0`).
- Fazer a limpeza de forma protegida: ela só ocorrerá se nenhuma nova mensagem do cliente tiver chegado durante o envio do follow-up.
- Não alterar mensagens comuns do IAGO, respostas humanas, outros envios automáticos ou a regra do webhook que marca novas entradas como não lidas.

## Validação
- Confirmar que um follow-up bem-sucedido deixa o card sem contador de não lidas.
- Confirmar que uma resposta posterior do cliente volta a exibir o contador.
- Confirmar que falhas de envio não limpam o contador.
- Publicar a função atualizada e conferir os registros da execução.

## Impacto técnico e custo
- Mudança restrita à função de follow-up do IAGO, com uma atualização simples no contato após envio bem-sucedido.
- Nenhum novo agendamento, consulta periódica ou chamada de IA; sem aumento relevante de custo.

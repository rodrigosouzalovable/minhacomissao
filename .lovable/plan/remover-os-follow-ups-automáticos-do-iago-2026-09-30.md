# Remover os follow-ups automáticos do IAGO

## Objetivo
O IAGO continuará respondendo imediatamente às mensagens recebidas na caixa PADRÃO, interpretando o histórico e transferindo dúvidas ou pedidos de atendimento humano pela fila. Ele deixará de procurar novamente clientes que pararam de responder.

## Alterações
- Desligar definitivamente as três retomadas automáticas atualmente configuradas (2h, 12h e 23h).
- Cancelar os 51 retornos que estão agendados, sem enviar nenhuma mensagem retroativa.
- Remover do atendimento do IAGO a criação de novos agendamentos de follow-up.
- Desativar a rotina que hoje verifica esses retornos a cada 15 minutos, reduzindo também processamento desnecessário.
- Retirar da configuração administrativa os controles de retomada, evitando reativação acidental.
- Preservar integralmente a resposta imediata, apresentação como assistente virtual, leitura do histórico, identificação de CPF e transferência atômica para um humano.

## Validação
- Confirmar que não existe retorno pendente após a limpeza.
- Simular cliente que para de responder e verificar que nenhum follow-up é agendado.
- Simular nova mensagem, CPF sem débito e pedido de humano para confirmar que atendimento e fila continuam funcionando.
- Validar a tela administrativa e o estado geral da aplicação sem enviar mensagens reais.

## Detalhes técnicos
A remoção será aplicada na configuração, no estado das conversas, no ponto que agenda novos retornos e no agendamento automático. Os campos históricos serão mantidos para auditoria, sem apagar registros anteriores.

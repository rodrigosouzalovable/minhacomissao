# Impedir respostas duplicadas da Clara

## Correção
- Criar uma trava atômica por conversa e mensagem recebida, reaproveitando o padrão já usado pelo IAGO.
- Fazer a Clara reservar a mensagem antes de consultar a IA ou enviar qualquer resposta.
- Ignorar chamadas repetidas do webhook para a mesma mensagem, inclusive quando chegarem quase simultaneamente.
- Marcar a mensagem como concluída após o processamento e manter apenas um histórico curto das entradas processadas.
- Preservar a trava por até dois minutos se uma execução estiver em andamento; após esse período, permitir nova tentativa em caso de falha interrompida.

## Validação
- Publicar a correção da função da Clara.
- Simular chamadas repetidas com a mesma mensagem e confirmar apenas um envio.
- Conferir os registros recentes e garantir que novas respostas não sejam repetidas.

## Custo e operação
A correção não cria rotina contínua, agendamento ou consulta periódica. Acrescenta somente duas operações pequenas no atendimento já existente, com impacto pontual e baixo.

# Concluir os lembretes automáticos Meta

## Variáveis confirmadas
O preenchimento inicial preparado corresponde ao pedido:
- **{{1}}:** nome do cliente do acordo.
- **{{2}}:** credor vinculado ao acordo — Novo Mundo, UME ou Odres Cred.
- **{{3}}:** vencimento da parcela, no formato DD/MM/AAAA.

Preservar o texto e os botões do template `novo_lembrete_envio_boleto_variavel/pt_BR`. Nunca usar o nome do funcionário no lugar desses dados. Dados ausentes impedem o envio.

## Autorização e conclusão
- O custo foi autorizado nesta conversa, incluindo a continuação temporária previamente apresentada: até 180 execuções por dia, apenas enquanto houver trabalho no ciclo, desligando ao concluir. Há processamento adicional no Cloud e possível cobrança das mensagens pela Meta.
- Concluir a validação do que foi preparado, corrigir eventuais falhas e liberar a ativação na tela, que atualmente permanece bloqueada aguardando autorização.
- Conferir uma prévia de destinatários, mensagens, funcionários, remetentes e estimativa antes da ativação. Testes não devem enviar mensagens reais.

## Regras a preservar
- Etapas D+1, D+3 e D+7 após o vencimento, até D+10, somente parcelas pendentes de acordos ativos.
- Revalidar pagamento, vencimento e situação do acordo imediatamente antes de enviar; não acumular etapas antigas nem duplicar cobranças com outras rotinas.
- Somente remetentes GREEN confirmados com cópia Utility aprovada, respeitando cotas, bloqueios e blacklist.
- Vincular a conversa ao funcionário que lançou o acordo, apenas em caixa onde ele já seja autorizado. Sem caixa compatível, manter pendente e mostrar o motivo.
- Não enviar aos domingos; retomada na segunda a partir das 08h BRT. Manter pausa e acompanhamento dos envios.
- Preservar a busca por nome e conteúdo no campo Templates HSM do Envio Meta.

## Validação técnica
- Revisar permissões, consultas, reserva atômica, atribuição de conversa e integração com o envio oficial.
- Verificar que a continuação inicia somente com trabalho autorizado, tem duração limitada e é removida ao concluir; não criar consulta permanente.
- Executar testes de datas, variáveis, GREEN obrigatório, pagamentos, isolamento, concorrência e deduplicação.
- Conferir a prévia e os controles de ativação/pausa na tela e publicar as funções necessárias após a validação.
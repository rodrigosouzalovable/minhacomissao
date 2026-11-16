# Respostas de lembrete de pagamento ficam com RODRIGO RIBEIRO DE SOUZA

## O que muda
Quando o cliente responder a um lembrete de pagamento (aviso de vencimento, vencido, repescagem da 1ª parcela, "Quero o boleto"), a conversa recebe a etiqueta **Atendente: RODRIGO RIBEIRO DE SOUZA**, e não mais a do funcionário que fez o acordo.

## Regras
- Vale para respostas a lembretes enviados automaticamente (UME, Odres, Novo Mundo).
- Se a conversa já tiver a etiqueta de um funcionário por causa do lembrete, ela é trocada pela sua na nova resposta.
- Conversas que não vieram de lembrete (portal, campanhas de carteira, consultas) seguem o rodízio atual.
- O boleto/PIX automático continua saindo na hora, sem mudança.
- Conversas já etiquetadas antes desta mudança não são alteradas (posso corrigir as antigas se quiser).

## Detalhes técnicos
- No recebimento das mensagens Meta, antes do "match por acordo", verificar se a última mensagem enviada nessa conversa foi um template de lembrete (lista dos templates usados por lembrete preventivo, cobrança de vencidos e repescagem, ex. `nova_parcela_vencida_2`, templates de vencimento com botão "QUERO O BOLETO").
- Se sim, aplicar a etiqueta existente "Atendente: RODRIGO RIBEIRO DE SOUZA" e remover outras etiquetas "Atendente:" atribuídas automaticamente (as travadas manualmente por admin ficam).
- Sem nova rotina agendada ou consulta pesada: uma leitura indexada da última mensagem enviada da conversa.

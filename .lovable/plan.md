# Verificar pagamento antes de enviar o aviso

## Situação verificada
- O botão **Verificar pagamento** consulta a saúde do número e a disponibilidade comercial da conta na Meta. Ele não reconecta o número nem altera o cartão.
- O aviso da imagem vem do tratamento de falhas de entrega. Já existe uma consulta preventiva, porém uma resposta inconclusiva ainda permite o alerta de restrição.
- Essa consulta genérica também considera limitações do número, que não necessariamente são problemas de pagamento.
- O aviso informa 24 horas mesmo quando o código de pagamento aplica uma pausa de 1 hora.
- O estado atual do pagamento desse número não foi confirmado nesta análise.

## Alteração proposta
1. Ao receber **#131042**, executar automaticamente uma revalidação equivalente ao botão **Verificar pagamento**, antes de enviar qualquer aviso de pagamento.
2. Se a Meta confirmar disponibilidade comercial, atualizar a informação antiga e retirar apenas a trava de pagamento que já foi resolvida. Preservar bloqueios reais, restrições de qualidade e exclusões manuais. Não enviar alerta de pagamento pendente.
3. Se a Meta confirmar que a restrição de pagamento continua, manter a proteção e enviar um aviso claro, com o número, horário da revalidação e orientação para conferir faturamento na Meta.
4. Se a consulta falhar ou vier incompleta, não afirmar que o cartão está irregular nem que o número foi banido. Manter os envios protegidos até confirmação, registrar o resultado inconclusivo e usar a rotina existente para nova verificação.
5. Evitar avisos duplicados da mesma ocorrência e apresentar a duração real da pausa, sem prometer liberação automática depois de uma hora.

### Exemplo de aviso confirmado
> **A Meta ainda informa restrição de pagamento para este número.**
>
> Instância: SOUZA 14 92007-1168 (Atendimento Maria).
>
> Fizemos uma nova verificação antes deste aviso e a restrição continua. Um cartão cadastrado não garante que a Meta já liberou o envio. Confira faturas e método de pagamento na Meta. Os envios deste número permanecem pausados até a liberação ser confirmada. Este erro não confirma banimento.

## Detalhes técnicos
- Compartilhar a classificação comercial usada pela verificação manual com os caminhos de erro de pagamento: webhook, envio manual e workers de campanha que emitam esse aviso.
- Diferenciar disponibilidade confirmada, restrição de pagamento confirmada, outra restrição e consulta inconclusiva; não inferir pagamento irregular apenas de um estado genérico LIMITED/BLOCKED.
- Usar consulta direcionada com tempo limite, sem chamadas recursivas, novos agendamentos ou aumento de volume de mensagens.
- Reutilizar resultados recentes da mesma ocorrência para evitar consultas repetidas entre envio e webhook.

## Validação
- Testar #131042 com conta disponível: não gera alerta de pagamento e remove somente a trava resolvida.
- Testar restrição de pagamento persistente: alerta apenas após revalidação, sem duplicação.
- Testar timeout e falta de permissão: não declara pagamento irregular e não libera envios indevidamente.
- Testar limitações por qualidade, bloqueio real e exclusão manual: permanecem respeitadas.
- Validar sem enviar mensagens reais para clientes.

## Custo
A checagem preventiva já existe; será substituída por uma verificação direcionada e reaproveitada na mesma ocorrência. Não haverá novo polling, cron ou aumento de disparos. Se a implementação exigir consultas adicionais com impacto de custo, apresentar estimativa e pedir autorização antes.

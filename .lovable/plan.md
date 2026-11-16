# Boleto com vencimento hoje (calculadora UME do Wesley)

## O que os registros de hoje mostram
- Outros atendentes (Rodrigo, Fernanda) e o IAGO conseguiram boletos para 16/11 hoje.
- Os dois clientes do Wesley (14h02 e 14h17) foram pedidos duas vezes cada e voltaram com 17/11 nas duas tentativas.
- A tela já aceita a data de hoje e o sistema envia a data escolhida. Quem devolve outra data é a UME. A causa exata ainda não está confirmada. As hipóteses são: já existia uma cobrança aberta para 17/11, ou o login dele recebe uma regra diferente para o mesmo dia.

## O que vou fazer
1. **Confirmar a causa:** vou repetir a consulta de um dos clientes do Wesley com o login dele e registrar a resposta completa da UME (data pedida, data devolvida e se a cobrança é nova ou reaproveitada). Também vou comparar com uma emissão para hoje que deu certo pelo login do Rodrigo.
2. **Se a UME estiver reaproveitando uma cobrança aberta:** vou pedir uma nova cobrança só para a parcela, na data de hoje, em vez de aceitar a cobrança antiga.
3. **Se a UME recusar o mesmo dia para o login do Wesley:** vou tentar automaticamente pela conta da empresa, só para o mesmo dia, e mostrar o aviso "emitido pela conta da empresa". Se você preferir que tudo saia sempre no nome dele, mantenho a recusa e mostro uma mensagem clara de que a UME não libera boleto para o mesmo dia nesse login.
4. **Melhor fuso na tela:** a data "hoje" da calculadora passa a seguir o horário de Brasília. Hoje ela segue o horário mundial, que depois das 21h já mostra o dia seguinte.
5. Os avisos continuam valendo: se a data devolvida não for a pedida, o atendente precisa confirmar antes de enviar.

## Detalhes técnicos
- `ume-parcela-atraso` e `ume-boleto`: registrar `invoiceDueDate`, o id e se a cobrança foi reaproveitada; em `naDataEscolhida`, tentar de novo via `/invoices/multiple` com o `installment_id` da carteira quando a data devolvida for diferente.
- `ConsultaUmeDialog.tsx`: `dataParaInput` passa a usar America/Sao_Paulo.
- Não muda valores nem regras de desconto.

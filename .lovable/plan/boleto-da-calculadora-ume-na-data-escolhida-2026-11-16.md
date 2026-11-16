# Boleto da calculadora UME na data escolhida

## O que está acontecendo
Para o CPF 016.579.735-57, os registros de hoje mostram 3 tentativas: duas pedindo 16/11 e uma pedindo 19/11. Nas três, a UME devolveu vencimento 17/11.

Este cliente é emitido pelo caminho "boleto rápido" da UME, que usa só o cadastro do cliente e não informa a parcela. Por esse caminho, a UME ignora a data pedida. O sistema até tenta emitir de novo na data certa, mas essa segunda tentativa precisa saber qual parcela está sendo cobrada. Como a resposta da UME não traz a parcela, a nova tentativa nunca acontece e aparece o aviso vermelho.

O backoffice consegue emitir para 19/11 porque lá o boleto é gerado em cima da parcela escolhida. É o mesmo tipo de emissão que já usamos quando temos a parcela em mãos.

## O que vai mudar
1. Quando a UME devolver outra data e não informar a parcela, o sistema busca na própria UME as parcelas em aberto do cliente: a mais antiga em atraso ou, se não houver atraso, a próxima a vencer.
2. Com essa parcela, emite o boleto pelo mesmo caminho do backoffice, usando exatamente a data escolhida (hoje ou qualquer dia futuro). O boleto continua saindo no login UME do atendente.
3. Por segurança, o boleto novo só é usado se:
   - a data devolvida for a data pedida; e
   - o valor for compatível com uma parcela, e não com o saldo inteiro.
   Se a UME recusar, o aviso vermelho continua aparecendo com a confirmação antes de enviar.
4. Cada tentativa registra a data pedida, a data devolvida e a parcela usada, para conferirmos qualquer caso que ainda falhe.

## Detalhes técnicos
- `ume-parcela-atraso`: em `naDataEscolhida`, quando `idsDaResposta` vier vazio, buscar os installment IDs pela consulta online (`consultarUme`, já usada para renegociação) e chamar `umeApi.gerarBoletos` (`/invoices/multiple`) com a `dueDate` escolhida. Isso vale para os três caminhos que hoje usam `/invoices/chatbot`: cliente online, cliente sem parcelas no SFTP e cliente com acordo.
- Usar a mesma trava de valor já aplicada ao boleto imediato (até 1,5× o valor da parcela).
- Nenhuma tarefa agendada nova e nenhuma consulta repetida: a busca extra só acontece quando a data volta diferente.

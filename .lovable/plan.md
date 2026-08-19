# Cancelamento automático de número marcado como banido

Hoje, ao marcar um número ativo como banido, ainda é preciso esperar os 5 minutos do provedor e clicar em "Cancelar" na mão. A mudança faz esse cancelamento acontecer sozinho.

## Comportamento novo

- Ao marcar o pedido ativo como **banido**, aparece o aviso "Banido — cancelamento automático quando liberar (em M:SS)".
- Quando o contador de 5 minutos zera, o sistema dispara o cancelamento sozinho, uma única vez, e mostra o toast de cancelado/reembolso.
- Se já passaram os 5 minutos no momento da marcação, o cancelamento é imediato.
- Se o código do SMS chegar antes de liberar, o cancelamento automático não acontece (o número foi usado).
- Desmarcar "banido" antes de liberar cancela o agendamento.
- Nada muda para números do histórico já cancelados/recebidos; o botão manual de cancelar continua existindo.

## Detalhes técnicos

- `src/components/acionamento/NumerosVirtuaisPanel.tsx`: novo `useEffect` que observa `pedidoAtivo.banido_em`, `segParaCancelar === 0`, ausência de `codigo` e status `aguardando`; usa um `useRef` com o `order_id` já disparado para evitar chamadas repetidas, e chama a mutation `cancelar` existente.
- Texto de estado do card do pedido ativo ajustado para indicar a espera do cancelamento automático.
- Sem mudanças no backend nem no banco.

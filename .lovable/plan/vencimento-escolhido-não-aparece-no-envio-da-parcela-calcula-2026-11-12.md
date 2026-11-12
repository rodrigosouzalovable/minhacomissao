# Vencimento escolhido não aparece no envio da parcela (calculadora UME)

## O que aconteceu
No histórico de cobranças do Wesley de hoje, todas foram geradas com vencimento 12/11. Nenhuma foi gerada para 24/11. Ou seja, ele mudou a data, mas não clicou em "Recalcular". O botão "Confirmar e enviar" mandou a cobrança antiga, com o valor e o PIX de 12/11.

## Correção
1. Ao trocar a data na janela de aprovação, o sistema pede à UME uma nova cobrança na hora, sem precisar clicar em "Recalcular".
2. "Confirmar e enviar" fica bloqueado enquanto a data escolhida for diferente da cobrança gerada ou enquanto o novo valor estiver sendo calculado. Um aviso explica o motivo.
3. Depois de recalcular, a mensagem é refeita com o novo valor, a nova data e o novo PIX.
4. Se a UME devolver uma data diferente da que foi pedida, aparece um alerta antes do envio.

## Detalhes técnicos
- Só muda `src/components/inbox/meta/ConsultaUmeDialog.tsx`: recálculo automático quando a data muda (com pequena espera), `disabled` no envio quando `vencParcela !== boleto.vencimento` ou durante o carregamento, e aviso de data divergente.
- A função `ume-parcela-atraso` já respeita a data enviada e não muda.

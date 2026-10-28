# Botão "Atualizar" no diálogo Acordo parcelado UME / Odres

## O que muda para você
- No topo do diálogo "Acordo parcelado UME / Odres (API oficial)" aparece um botão **Atualizar**.
- Ao clicar, o sistema limpa a tentativa anterior (simulação, erro e aviso de "acordo em aberto") e consulta a UME de novo **na hora**, sem usar a cópia salva das últimas 12 horas.
- Se a UME já tiver encerrado/quebrado o acordo antigo, a tela abre normalmente e você segue para "Simular na UME" e "Gerar boleto e PIX".
- Se a UME continuar recusando, a mensagem em português informa que **a própria UME** ainda considera um acordo em aberto, com o número quando vier na resposta, para pedir o encerramento.

## Observação importante
No print, todos os acordos aparecem como Quebrado ou Pago. Se a recusa vier do lado da UME, o botão só resolve depois que o sistema dela liberar. O botão garante que nunca ficaremos presos a uma resposta antiga.

## Detalhes técnicos
- `AcordoUmeApiDialog.tsx`: botão Atualizar (ícone RefreshCw, girando enquanto carrega) que zera `simulacao`, `erro` e `efetivado` e chama `carregar(cpf, { forcar: true })`.
- `ume-acordo-api` (ação `carregar`/`simular`): aceita `forcar: true` e, nesse caso, ignora o cache de 12h do `consultarUme` (parâmetro de bypass em `_shared/ume-desconto.ts`), regravando o cache com o resultado novo.
- Gravar no `ume_acordo_api_log` o texto bruto da recusa para conferirmos depois de onde vem o "acordo em aberto".
- Sem custo recorrente: só consulta quando o botão é clicado.

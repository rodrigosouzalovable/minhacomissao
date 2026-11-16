# Boletos UME no nome do atendente conectado

## O que foi encontrado
O caso do Wesley (boleto 1003275192, R$ 234,38) não foi um acordo de renegociação, e sim o envio da **parcela em aberto atualizada** (boleto + PIX). A correção anterior cobriu apenas a efetivação de acordo. Os caminhos de boleto continuam:
- chamando a UME com a **conta da empresa**, mesmo com o login do Wesley ativo (o login só é conferido, não usado);
- enviando o campo de operador fixo como **"Souza e Ribeiro"**.

Por isso o backoffice mostra "SOUZA RIBEI...".

## O que muda
1. Todo boleto/PIX gerado por um atendente na Calculadora UME (parcela em aberto, parcela em atraso, boleto único) passa a ser gerado com o login UME do próprio atendente e com o nome/código de operador dele.
2. Se o login UME do atendente estiver desconectado ou expirado, aparece o aviso para conectar antes de gerar (como já ocorre no acordo).
3. Envios automáticos (portal, IAGO, botão "Quero o boleto", rotinas diárias) continuam no nome "Souza e Ribeiro", pois não têm atendente.
4. Na efetivação de acordo, passar também a usar o login do atendente na chamada (hoje só o nome vai no corpo).

## Detalhes técnicos
- `_shared/ume-api.ts`: `gerarBoletos` e `gerarBoletoUnico` recebem `operador?` opcional; `generatedAt = operador?.nome || UME_ASSESSORIA` e `operatorId` quando houver.
- `ume-parcela-atraso`: trocar `alvo = ambiente` por `{ amb, token: sessao.token }` quando há sessão do atendente, e passar `operadorDoToken(...)`.
- `ume-boleto`: mesmo ajuste quando `origem === 'atendente'`.
- `ume-acordo-api`: em `efetivar`, chamar `fecharAcordo` com o token da sessão.
- Tratar `ume_login_expirado` com a mensagem de login. Fazer deploy das 3 funções.
- Validação: o próximo boleto do Wesley deve aparecer no nome dele no backoffice; se a UME ainda mostrar o nome da empresa, ela ignora esses campos e é preciso confirmar com a UME.

# Boleto UME na data escolhida pelo atendente

## O que acontece hoje
- A tela já deixa escolher hoje ou qualquer data futura (datas passadas ficam bloqueadas).
- No caso do Wesley (cliente Victor), o sistema pediu 16/11 à UME, mas a UME devolveu o boleto de 25/11 duas vezes (11h00).
- Esse cliente não está nos arquivos do SFTP. Nesse caso o sistema usa um pedido "geral" da UME, que tende a reaproveitar a cobrança já aberta do cliente (25/11) em vez de criar uma nova na data pedida.

## O que vou mudar
1. **Segunda tentativa na data certa:** se a UME devolver outra data, o sistema busca online as parcelas em aberto desse cliente e pede o boleto delas direto na data escolhida (o mesmo pedido usado para clientes do SFTP, que respeita a data).
2. **Data escolhida vale também no "Gerar boleto + PIX"** de baixo da tela, com a mesma segunda tentativa.
3. **Se mesmo assim a UME insistir em outra data:** o botão "Confirmar e enviar" fica travado com o aviso "A UME só liberou para DD/MM", e o atendente decide se envia nessa data ou não. Nada sai para o cliente com data diferente sem ele ver.
4. Datas passadas continuam bloqueadas, na tela e no servidor.

## Detalhes técnicos
- `ume-parcela-atraso`: nos ramos `gerarBoletoUnico` (online e sem parcelas SFTP), comparar `boleto.vencimento` com `escolhido`; se divergir, obter `installment_id`s em aberto via consulta online UME (`consultarUme` perfil completo) e chamar `gerarBoletos(alvo, ids, escolhido, operador)`. Retornar `divergente: true` se ainda não bater.
- `ume-boleto` (acao gerar, origem atendente): mesma lógica.
- `ConsultaUmeDialog.tsx`: usar `divergente` para exigir confirmação explícita antes de enviar.
- Primeiro passo da implementação: testar com o CPF do Victor para confirmar que o pedido por parcelas respeita a data de hoje; se a UME recusar também, a causa é regra da UME e o aviso do item 3 passa a ser a solução.

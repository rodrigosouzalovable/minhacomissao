# Silenciar o sino de verdade e remover o aviso "Áudio transcrito"

## 1. Som do sino continua tocando com o alto-falante desligado
O que já foi conferido: o aviso de nova mensagem com a sua etiqueta já respeita o botão. Mas o mesmo som do sino também toca no aviso de **Retornos agendados** (alerta que aparece no horário do retorno), e esse aviso ainda ignora o botão. Como o som é idêntico, parece que o sino "não desligou".

O que muda:
- O botão de alto-falante passa a silenciar **todos os sons do sino**: nova mensagem com sua etiqueta e alertas de retorno.
- Os avisos visuais (contador do sino e janela do retorno) continuam aparecendo normalmente, só sem som.
- O som de comemoração ao registrar um pagamento num acordo continua como está.
- Depois de aplicar, vou abrir a tela, desligar o som e conferir que nenhum desses sons tenta tocar.

Observação: no endereço oficial (meusacordos.com.br) a correção só vale depois de publicar.

## 2. Aviso "Áudio transcrito — Revise o texto e clique em enviar"
- No Inbox Meta, depois de gravar e o sistema transcrever, esse aviso no canto inferior direito deixa de aparecer.
- O texto transcrito continua indo para o campo de mensagem, como hoje.
- Avisos de erro (por exemplo, falha na transcrição) continuam aparecendo.

## Detalhes técnicos
- `RetornoAlertChecker.tsx`: checar `somConversasAtivo(user.id)` antes dos dois `audio.play()`.
- `MetaAtendenteNotifier.tsx`: já checa; manter.
- `InboxMeta.tsx` linha ~1625: remover o `toast({ title: 'Áudio transcrito', ... })` de sucesso.

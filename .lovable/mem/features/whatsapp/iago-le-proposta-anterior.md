---
name: IAGO lê a proposta já enviada antes de pedir CPF
description: Quando existe mensagem nossa anterior (campanha/template) com valor de proposta, o IAGO retoma essa proposta e nunca pede CPF de entrada; respostas automáticas do cliente são ignoradas
type: feature
---

- `detectarPropostaPrevia` varre as mensagens de **saída** do histórico buscando `R$ x,xx` junto de termos de proposta (à vista, parcelado, desconto, débito, autorizado). Achou → o prompt recebe bloco "PROPOSTA JÁ ENVIADA POR NÓS" com valor + texto original.
- Nesse caso é **proibido** pedir CPF/documento na resposta: o IAGO pergunta se o cliente viu a condição à vista de R$ X (mesmo valor, sem arredondar), o que achou, e oferece verificar parcelamento. CPF só depois, se o cliente quiser parcelar.
- `contexto.proposta_enviada` também é marcado quando a proposta veio de mensagem nossa anterior (follow-up já pode falar "conseguiu ver a proposta?").
- `ehRespostaAutomatica` detecta mensagem automática de ausência (frases padrão + link): o IAGO não responde o conteúdo, não comenta o link e retoma a negociação.

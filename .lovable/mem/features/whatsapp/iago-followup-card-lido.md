---
name: Follow-up do IAGO mantém card lido
description: Retornos automáticos do IAGO zeram não lidas com proteção contra respostas simultâneas do cliente
type: feature
---

- Após um follow-up do IAGO enviado com sucesso, o card da conversa deve ficar lido (`nao_lido = 0`).
- A limpeza só pode ocorrer se `ultima_msg_entrada_em` continuar igual à entrada observada antes do envio.
- Se o cliente responder durante ou depois do follow-up, a entrada real deve continuar marcando a conversa como não lida.
- Falhas de envio nunca limpam o contador.
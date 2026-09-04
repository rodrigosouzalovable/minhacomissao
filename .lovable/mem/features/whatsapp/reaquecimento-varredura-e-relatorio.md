---
name: Reaquecimento YELLOW/RED por varredura + relatório em 2 números
description: check-meta-instance-health religa reaquecimento de qualquer número próprio YELLOW/RED sem depender do momento da queda; relatório 13h/18h sempre enviado para 62991672674 e 62994300880
type: feature
---

- Em `check-meta-instance-health`, além do gatilho de queda (`caiu`), há a **varredura de reconciliação**: todo número `provider='meta'`, `aquecimento_qualidade_permitido !== false`, `qualidade_liberada_manual !== true` que esteja em YELLOW/RED com `recuperacao_ativa !== true` volta ao reaquecimento (meta do dia sorteada, `recuperacao_proximo_envio_em = now()`), sem reiniciar quarentena. Aviso `meta_aquecimento_religado` (1x por número por dia) nos 2 destinos.
- `meta-recuperacao-relatorio` (13h e 18h BRT) **nunca fica em silêncio**: sem ninguém em reaquecimento, envia alerta listando os YELLOW/RED sem tratamento, ou confirma que todos estão saudáveis.
- Relatórios de reaquecimento vão sempre para `5562991672674` e `5562994300880` via `destinatarios` do `notificar-admin`.

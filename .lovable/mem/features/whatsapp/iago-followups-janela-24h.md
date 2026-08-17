---
name: IAGO Follow-ups 24h
description: 3 retomadas por janela (2h, 12h, 23h) com mensagem diferente e última chance antes de fechar; nunca faz follow-up em número errado
type: feature
---

- Até 3 follow-ups dentro da mesma janela de 24h da Meta: etapa 1 em `followup_horas` (2h), etapa 2 em 12h, etapa 3 em 23h (ou última passagem permitida antes de a janela fechar). Sempre com texto diferente, dentro do horário permitido (08–19h BRT).
- Só menciona "proposta" se valores realmente foram enviados.
- **Número errado / negação de identidade nunca gera follow-up**: `ehNumeroErrado` reconhece também "não sou <nome>" sem artigo ("Não sou Sebastiao"), "aqui não é o X", "quem fala não é", além de número errado/engano/não conheço. O `iago-followup-tick` faz uma segunda checagem no histórico de entrada antes de cada envio; se detectar negação, cancela o follow-up de vez (`followup_feito=true`, `followup_etapa=3`, `aguardando_humano=true`, `etapa='numero_errado'`), aplica a etiqueta "Aguardando Humano" e não envia nada.

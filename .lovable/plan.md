# Botão "Não precisa resposta" no topo da conversa

## O que muda

- No topo da conversa, ao lado dos botões **Qualificação** e **Modelo**, entra um checkbox **"Não precisa resposta"**.
- Ao marcar, o card dessa conversa na lista volta imediatamente à cor original (sai do amarelo/vermelho de 15/30 min).
- A dispensa vale apenas para a última mensagem recebida. Se o cliente mandar **qualquer nova mensagem**, a contagem reinicia: 15 min → amarelo piscando, 30 min → vermelho piscando.
- Se o atendente responder, o comportamento atual continua (volta ao normal na hora).
- O checkbox aparece desmarcado automaticamente quando chega mensagem nova do cliente.
- A marcação é por conversa e compartilhada entre os atendentes da caixa (fica gravada, não é só visual no navegador).

## Detalhes técnicos

- Banco: adicionar coluna `sla_dispensado_em timestamptz null` em `meta_whatsapp_contatos` (sem alteração de RLS/grants — as políticas de update existentes já cobrem).
- `src/pages/InboxMeta.tsx`:
  - incluir `sla_dispensado_em` no `selectCols` (linha ~534) e no tipo do contato (linha ~69);
  - em `computeEspera` (linha ~994), receber também `sla_dispensado_em` e retornar `nivel: 'ok'` quando `sla_dispensado_em >= ultima_msg_entrada_em` — assim uma mensagem nova do cliente (que atualiza `ultima_msg_entrada_em`) invalida a dispensa sozinha, sem limpeza extra;
  - novo botão/checkbox no cabeçalho (perto da linha ~1756) que grava `sla_dispensado_em = now()` ao marcar e `null` ao desmarcar, com atualização otimista no estado local.
- Sem novo cron, polling, realtime ou consulta extra: **custo Lovable Cloud inalterado**.

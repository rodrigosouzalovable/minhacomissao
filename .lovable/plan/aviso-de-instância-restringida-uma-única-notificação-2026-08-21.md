# Aviso de instância restringida: uma única notificação

## Causa

A checagem de "já avisei?" é feita lendo o log de notificações, mas o registro só é gravado **depois** do envio. Quando a Meta devolve várias falhas da mesma instância no mesmo instante (foi o caso: vários itens de campanha falhando com #131031), quatro execuções rodam em paralelo, todas leem o log vazio e todas enviam — daí as 4 mensagens no mesmo segundo.

Confirmado no banco: os avisos de `meta_instancia_restrita` usam chave por instância + dia, mas nada impede envios simultâneos antes do primeiro registro existir.

## O que será feito

1. **Reserva antes de enviar (trava atômica)**: criar uma restrição de unicidade na chave de notificação e, antes de disparar, gravar o registro como "reservado". Se outra execução tentar reservar a mesma chave, ela é recusada e não envia nada. Depois do envio, o registro é atualizado para enviado/erro.
2. **Um aviso por instância enquanto a restrição durar**: além do dia, o aviso passa a ser suprimido se a instância já estiver marcada como restrita/pausada — ou seja, só notifica na transição de "normal" para "restrita". Nova mensagem só quando a instância voltar a funcionar e for restringida novamente.
3. **Vale para os dois pontos de origem**: webhook de status da Meta e falha síncrona no envio passam a compartilhar a mesma trava, então não duplicam entre si.
4. **Sem perda de aviso real**: se a entrega falhar em todas as instâncias, o registro fica como erro e o reenvio manual (função existente) continua funcionando.

## Detalhes técnicos

- Migração: índice único em `admin_notificacoes_log (tipo, chave_idempotencia)`; limpeza prévia de duplicatas existentes para o índice poder ser criado.
- `supabase/functions/_shared/notificar-admin.ts`: substituir o `select` de idempotência por um `insert` de reserva (status `reservado`) com tratamento de conflito → retorna `skipped: 'ja_enviado'`; ao final, `update` do mesmo registro para `enviado` ou `erro`. A reserva é por chave + destinatário, mantendo o comportamento multi-destino.
- `supabase/functions/meta-whatsapp-webhook/index.ts` e `supabase/functions/send-whatsapp-meta/index.ts`: só chamar `notificarAdmin` quando a instância ainda não estiver com `estado_pool = 'restrita'` / pausa ativa (ler o estado antes do `update` e comparar), mantendo a chave por instância + dia.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo.

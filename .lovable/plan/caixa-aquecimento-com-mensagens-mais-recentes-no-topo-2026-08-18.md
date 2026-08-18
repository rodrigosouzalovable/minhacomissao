# Caixa AQUECIMENTO com mensagens mais recentes no topo

## Objetivo
Garantir que, dentro da caixa **AQUECIMENTO**, a conversa com a mensagem mais recente apareça sempre em primeiro lugar.

## Alteração
- Aplicar à caixa AQUECIMENTO uma ordenação estrita por `ultima_mensagem_em`, da mais recente para a mais antiga.
- Nessa caixa, a data da última mensagem terá prioridade inclusive sobre conversa fixada e alerta amarelo/vermelho, evitando que conversas antigas de 17/08 permaneçam acima das mensagens de hoje.
- Manter o comportamento atual das demais caixas, incluindo fixadas e prioridade por alerta de espera.
- Preservar filtros, busca, não lidas, arquivadas e “Meus Clientes”.

## Validação
- Abrir a caixa AQUECIMENTO e confirmar que o primeiro card corresponde ao maior horário de `ultima_mensagem_em` registrado no banco.
- Confirmar que uma nova mensagem recebida ou enviada move a conversa imediatamente para o topo.
- Verificar que as demais caixas continuam com a ordenação atual.

## Detalhes técnicos
- Ajustar somente o comparador de `contatosFiltrados` em `src/pages/InboxMeta.tsx`, tratando AQUECIMENTO antes das regras de fixação e SLA.
- Não haverá alteração no banco, nova consulta, cron, polling ou canal em tempo real; custo recorrente inalterado.

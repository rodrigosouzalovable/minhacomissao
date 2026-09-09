# Aquecimento dos leads do Google Maps na caixa AQUECIMENTO

## Situação hoje

As mensagens que o sistema envia para os leads do Google Maps saem direto pela API da Meta e **não criam conversa em caixa nenhuma** — ficam apenas num registro interno de aquecimento. Consequências:

- Você não consegue ver essas conversas no Inbox.
- Quando o lead responde, a conversa entra como conversa nova comum, na caixa padrão do número, podendo receber etiqueta de atendente e atendimento automático.

## O que será feito

1. Toda mensagem enviada para lead do Google Maps passa a criar/atualizar a conversa dentro da caixa **AQUECIMENTO**, com a mensagem registrada no histórico (igual às demais conversas do Inbox).
2. A conversa recebe uma marca de origem "lead Google Maps", para separar visualmente dos números próprios de aquecimento dentro da mesma caixa.
3. As respostas do lead caem na mesma conversa, na caixa AQUECIMENTO — não mais na caixa padrão.
4. Essas conversas ficam **fora do atendimento automático**: o IAGO não responde os leads, apenas a resposta é registrada para medir engajamento.
5. Nenhuma etiqueta de atendente e nenhum rodízio é aplicado a essas conversas, para não gerar trabalho para a equipe.
6. O relatório diário das 20h passa a citar a caixa AQUECIMENTO como local dessas conversas.

## Detalhes técnicos

- Nova coluna `origem_aquecimento` (texto) em `meta_whatsapp_contatos`, marcada como `lead_google_maps`.
- `meta-aquecimento-tick`: após envio com `fonte = 'lead'`, faz upsert em `meta_whatsapp_contatos` com `folder_id = 4f7a52c0-9c86-4b80-8867-4ade7a6df441` (AQUECIMENTO) e insere a mensagem de saída em `meta_whatsapp_mensagens` com o `wamid` retornado.
- `meta-whatsapp-webhook`: quando o contato existente tem `origem_aquecimento = 'lead_google_maps'`, preserva o `folder_id` AQUECIMENTO, pula o bloco de etiqueta de atendente/rodízio e não dispara IAGO.
- `_shared/iago.ts` / gate de atendimento: retorno antecipado para contatos com `origem_aquecimento = 'lead_google_maps'`, independentemente da regra atual da caixa AQUECIMENTO (que hoje faz o IAGO responder tudo).
- Sem novo cron, sem novo polling — reaproveita o tick de aquecimento existente, sem impacto de custo.

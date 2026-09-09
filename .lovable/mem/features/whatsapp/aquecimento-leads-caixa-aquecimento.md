---
name: Leads Google Maps na caixa AQUECIMENTO
description: Envios de aquecimento para leads do Google Maps aparecem na caixa AQUECIMENTO, sem IAGO, sem etiqueta de atendente e fora do rodízio
type: feature
---
- Todo envio de aquecimento com `fonte = 'lead'` cria/atualiza o contato na caixa AQUECIMENTO (`4f7a52c0-9c86-4b80-8867-4ade7a6df441`) com `meta_whatsapp_contatos.origem_aquecimento = 'lead_google_maps'` e grava a mensagem de saída no Inbox.
- Respostas desses leads ficam na mesma conversa; o webhook não aplica etiqueta de atendente, não entra no rodízio e não aciona IA/IAGO.
- `iago-atendimento` retorna skip imediato para contatos com `origem_aquecimento = 'lead_google_maps'`.

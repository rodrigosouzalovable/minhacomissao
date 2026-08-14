---
name: Etiqueta de atendente vai para quem atender primeiro
description: Inbox Meta não etiqueta mais no primeiro envio; a etiqueta fica com o primeiro atendente que responder (IA só na própria vez do rodízio)
type: feature
---
- Conversa NOVA (primeiro envio nosso) nunca recebe etiqueta de atendente.
- A etiqueta `Atendente: <Nome>` (origem `auto_atendente`) é aplicada quando um atendente humano atende: texto livre (`send-whatsapp-meta-text`) ou reabertura com template (`send-whatsapp-meta`, só quando o contato já existe), sempre com `somenteSeSemEtiqueta: true`.
- Vale o **atendente nomeado** na mensagem (prefixo `*Atendente <Nome>:*`) ou, na falta, o `profiles.nome` do `user_id` remetente.
- Elegibilidade: permissão `user_permissions.atende_inbox_meta` + ser responsável pela caixa (`meta_inbox_folder_members`, ou `meta_inbox_default_members` quando `folder_id` nulo).
- No webhook (cliente responde): mantidos os matches automáticos por **acordo lançado** e por **consulta de CPF no portal (7 dias)**. O match por "quem iniciou a conversa" foi removido.
- Rodízio: `atribuir_atendente_rodizio(p_contato_id, p_somente_ia)` sempre avança o ponteiro da fila, mas com `p_somente_ia = true` (uso do webhook) só grava a etiqueta quando a vez é do IAGO. Vez de humano = conversa sem etiqueta, aberta para quem atender primeiro.
- O sistema nunca cria etiquetas; só usa existentes. Mensagens da IA (`origem='ia'`) não etiquetam. Máximo uma etiqueta de atendente por conversa.

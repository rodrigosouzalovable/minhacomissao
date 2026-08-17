---
name: Conversas do Inbox Meta nunca desaparecem
description: Conversa com resposta do cliente nunca é excluída nem arquivada; exclusão definitiva é admin-only e só sem resposta
type: constraint
---

Regras invioláveis do Inbox Meta Oficial:

- Conversa com **qualquer** mensagem de entrada do cliente nunca é excluída (UI arquiva no lugar) e nunca é arquivada pela retenção.
- Exclusão definitiva de conversa: **somente admin** e somente quando `ultima_msg_entrada_em IS NULL`. Garantido por policy RESTRICTIVE `meta_contatos_delete_admin_sem_resposta` em `meta_whatsapp_contatos` + guardas na UI.
- `meta-inbox-retention`: corte de **3 dias (72h)** após o último envio; além de `ultima_msg_entrada_em`, confere mensagens de entrada reais em `meta_whatsapp_mensagens` (mesma instância, sufixo 8 dígitos) antes de arquivar. Fixadas, não lidas e com etiqueta continuam protegidas.
- A busca do Inbox pesquisa também as conversas arquivadas (badge "Arquivada" no card).

---
name: Admin de caixa não entra no rodízio
description: Membros marcados como admin da caixa do Inbox Meta apenas acompanham; nunca recebem conversas do rodízio automático
type: feature
---
- Membro com `admin = true` em `meta_inbox_folder_members` / `meta_inbox_default_members` é excluído do rodízio automático (`atribuir_atendente_rodizio`) e da elegibilidade do webhook `meta-whatsapp-webhook`.
- Fallback: se TODOS os responsáveis da caixa forem admin, eles voltam a participar para nenhuma conversa ficar sem atendente.
- Etiqueta por resposta manual continua permitida para o admin.
- No diálogo de atendentes, admin exibe o selo "só acompanha" em vez de "fora da fila".

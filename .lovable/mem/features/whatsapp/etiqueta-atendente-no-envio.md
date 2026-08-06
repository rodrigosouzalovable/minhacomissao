---
name: Etiqueta de atendente aplicada no envio
description: Inbox Meta etiqueta a conversa com o atendente nomeado já no envio, sem esperar resposta do cliente
type: feature
---
- Ao enviar template (`send-whatsapp-meta`) ou texto livre (`send-whatsapp-meta-text`), a conversa recebe imediatamente a etiqueta `Atendente: <Nome>` (origem `auto_atendente`).
- Vale o **atendente nomeado** na mensagem (prefixo `*Atendente <Nome>:*` ou `atendente_nome` no payload), NÃO o remetente técnico do disparo (admin/login usado).
- Elegibilidade: permissão `user_permissions.atende_inbox_meta` + ser responsável pela caixa (`meta_inbox_folder_members`, ou `meta_inbox_default_members` quando `folder_id` nulo).
- O sistema nunca cria etiquetas; só usa existentes (match por prefixo do primeiro nome, etiqueta mais específica ganha).
- Texto livre só etiqueta se a conversa ainda não tiver etiqueta de atendente; mensagens da IA (`origem='ia'`) não etiquetam.
- Lógica compartilhada em `supabase/functions/_shared/etiqueta-atendente.ts`.
- Disparos em massa (Envio Meta / Rajada) não enviam `atendente_nome` e seguem sem etiqueta.

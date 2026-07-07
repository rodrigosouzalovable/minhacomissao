## Problema

No `MetaNovaConversaDialog`, a query filtra `status = 'APPROVED'`, mas no banco `meta_whatsapp_templates.status` é armazenado em minúsculas (`approved`). Resultado: o `<Select>` de templates fica vazio.

## Correção

**`src/components/inbox/meta/MetaNovaConversaDialog.tsx`**
- Alterar o filtro de `.eq('status', 'APPROVED')` para `.eq('status', 'approved')`.
- Manter o filtro `.eq('categoria', 'UTILITY')` (categoria continua em maiúsculas no banco, conforme padrão da Meta).
- Sem alterações de schema, RLS ou edge functions.

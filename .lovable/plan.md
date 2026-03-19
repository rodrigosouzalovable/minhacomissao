

## Plan: Add WhatsApp Send with Instance Selection to Acordos Tabs

### What the user wants
When clicking the existing WhatsApp button on each agreement card in the "Próximas ao Vencimento", "Acordos Realizados", and "Vencidas" tabs, instead of sending a fixed confirmation message, the system should:
1. Show a dropdown/popover to select which WhatsApp instance to use (from user's connected instances)
2. Send the appropriate reminder message based on the installment's due date, using the configured reminder templates

### Current behavior
- The WhatsApp button sends a hardcoded confirmation message using the first active instance
- No instance selection UI exists on this page

### Technical approach

**File: `src/pages/Acordos.tsx`**

1. **Fetch all active WhatsApp instances** (not just one) — change the existing query to fetch all active instances with `id, nome, server_url, instance_token`

2. **Fetch reminder templates** — add a query for `lembrete_mensagens_templates` (active ones for the user)

3. **Add state for the WhatsApp send popover**:
   - `whatsappAcordo` — the acordo being targeted
   - `selectedInstanceId` — which instance is selected

4. **Determine the reminder type** from the acordo's context:
   - If the acordo is in the "Próximas ao Vencimento" tab → tipo `'3_dias'` or `'hoje'` based on `dataProximaPorAcordo`
   - If in "Acordos Realizados" or "Vencidas" tab → tipo `'vencido'` based on `dataVencidaPorAcordo`
   - Calculate `dias_atraso` from the nearest pending due date

5. **Replace `handleEnviarWhatsApp`** — instead of sending directly, open a small Dialog/Popover showing:
   - List of active WhatsApp instances as selectable options
   - A "Send" button that generates the message using the template engine (same `substituirVariaveis` logic from `WhatsAppSendingContext`) and sends via `send-whatsapp` edge function

6. **Fetch the next pending installment data** for the target acordo (valor_parcela, data_prevista) to populate template variables correctly — query `pagamentos` table for the next pending installment of that acordo

7. **Add a small Dialog component** at the bottom of the page with:
   - Instance selector (radio buttons or simple list)
   - Send button
   - Loading state

### Key details
- Reuse the same template matching logic from `WhatsAppSendingContext` (match `tipo_lembrete` key based on days overdue)
- The operator name comes from the existing `profile` query
- After sending, show success/error toast (existing pattern)
- Only show the instance selector when there are 2+ instances; if only 1, use it automatically


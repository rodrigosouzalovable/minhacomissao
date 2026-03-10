

# Fix: Dialog WhatsApp config overflow

## Problem
The "Configurações WhatsApp" dialog uses `max-w-lg` which is too narrow for the content (instances list with badges, checkboxes, etc.), causing horizontal overflow.

## Change

### `src/pages/Acionamento.tsx` (line 1308)
Change the DialogContent className from `max-w-lg` to `max-w-2xl` (or `max-w-xl`) to give enough horizontal space for the instance cards with their badges ("Ativo", "Conectado", "Só Lembretes"), toggle switches, and "Apenas Lembretes" checkboxes.

```tsx
// From:
<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
// To:
<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
```

This single change widens the dialog to accommodate all content without horizontal scrolling while keeping vertical scroll intact.


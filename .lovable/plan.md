

## Corrigir mensagens enviadas não aparecendo no Inbox

### Causa Raiz
O `logToInbox` no `whatsapp-ia-responder` salva `telefone_remoto` como `5562981343083` (formato completo com DDD+9), mas o webhook salva o contato com telefone `556281343083` (sem o "9"). O Inbox faz **match exato** (`.eq('telefone_remoto', contatoAtivo.telefone)`), então as mensagens de saída não aparecem porque o telefone é diferente.

**Dados reais:**
- Contato: `556281343083`
- Mensagens `entrada`: `556281343083` ✓ aparecem
- Mensagens `saida`: `5562981343083` ✗ não aparecem

### Solução: Corrigir em 2 pontos

#### 1. `logToInbox` no `whatsapp-ia-responder` — usar o telefone do contato existente
Na função `logToInbox`, após encontrar o contato por sufixo, usar o telefone do contato para salvar a mensagem (em vez do telefone de entrada):

```typescript
// Buscar contato com sufixo (já faz isso)
const { data: contato } = await sb.from("whatsapp_contatos")
  .select("id, telefone")  // adicionar telefone
  ...

// Usar contato.telefone para o insert da mensagem
const phoneToStore = contato?.telefone || cleanPhone;
await sb.from("whatsapp_mensagens").insert({
  telefone_remoto: phoneToStore,  // usar formato do contato
  ...
});
```

#### 2. Inbox query — usar suffix matching como fallback
No `WhatsAppInbox.tsx`, trocar `.eq('telefone_remoto', contatoAtivo.telefone)` por um filtro de sufixo (últimos 8 dígitos) nos 3 locais:
- Linha 265: query de mensagens
- Linha 349: realtime filter
- Linha 398: mark as read

Usar `.or()` com ambos os formatos, ou `.ilike('%' + suffix)`.

#### 3. Corrigir mensagens existentes no banco
Executar SQL para normalizar os `telefone_remoto` das mensagens de saída que não batem com o contato.

### Arquivos Modificados
- `supabase/functions/whatsapp-ia-responder/index.ts` — logToInbox usa telefone do contato
- `src/pages/WhatsAppInbox.tsx` — suffix matching na query e no realtime
- SQL para corrigir dados existentes

### Resultado
Todas as mensagens (enviadas e recebidas) aparecerão na conversa de cada instância no Inbox.


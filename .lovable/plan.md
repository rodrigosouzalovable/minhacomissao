

## Corrigir mensagens enviadas que não aparecem no WhatsApp Inbox

### Causa raiz
O webhook (`whatsapp-chatbot`) salva mensagens usando o telefone **exato** que vem do payload UAZAPI (ex: `556281035295`), mas o contato no banco pode estar salvo com formato diferente (ex: `6281035295` ou `5562981035295`). Como a busca é por igualdade exata (`eq('telefone', inboxTelefone)`), a mensagem é salva com um telefone "diferente" e não aparece na conversa.

O mesmo problema afeta:
- **Mensagens `fromMe`** (enviadas pelo WhatsApp app): salvas com telefone diferente do contato
- **Dedup de `fromMe`**: busca por telefone exato, não encontra a mensagem salva pelo `send-whatsapp` (que usa o telefone do contato), e salva duplicata com formato diferente
- **Mensagens de entrada**: mesma lógica — busca contato por telefone exato

### Solução
Aplicar **matching por sufixo (últimos 8 dígitos)** em TODA a lógica de inbox do webhook, igual ao que `send-whatsapp` já faz:

### Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`

**1. Após resolver o `instanciaId` (linha ~1129), buscar o contato existente por sufixo:**
```typescript
const suffix = inboxTelefone.slice(-8);
const { data: existingContact } = await supabase
  .from('whatsapp_contatos')
  .select('id, telefone, nao_lido')
  .eq('instancia_id', instanciaId)
  .like('telefone', `%${suffix}`)
  .maybeSingle();

const telefoneParaSalvar = existingContact?.telefone || inboxTelefone;
```

**2. Usar `telefoneParaSalvar` em TODOS os inserts de `whatsapp_mensagens`** (tanto `fromMe` quanto entrada)

**3. Atualizar a dedup de `fromMe`** para usar suffix matching:
```typescript
const { data: existing } = await supabase
  .from('whatsapp_mensagens')
  .select('id')
  .eq('instancia_id', instanciaId)
  .like('telefone_remoto', `%${suffix}`)
  .eq('direcao', 'saida')
  .gte('timestamp_msg', thirtySecsAgo)
  .limit(1)
  .maybeSingle();
```

**4. Atualizar as buscas de contato** (tanto para `fromMe` quanto entrada) para usar o contato já encontrado por sufixo, evitando buscas duplicadas

### Resultado
- Toda mensagem (texto, áudio, imagem) será salva com o formato de telefone correto do contato
- Mensagens enviadas pelo WhatsApp app aparecerão na conversa
- Mensagens enviadas pelo Inbox não serão duplicadas
- Mensagens recebidas continuarão funcionando normalmente




## Plano: Garantir que o webhook seja criado JÁ ATIVO + filtros corretos

### Causa raiz (confirmada nos logs)

Para a instância `IPHONE B1 22/04` (e várias outras), o `reinforceWebhook` rodou com sucesso, mas a UAZAPI criou o webhook com `enabled: false`. O verify atual só checa URL + evento, ignora o flag `enabled` — por isso marca como OK e você acha que funcionou. Resultado: você precisou ativar manualmente.

Bonus: o servidor UAZAPI dessa versão **descartou** `excludeMessages: ["wasSentByApi","isGroupYes"]` (salvou `[]`). Os filtros que essa versão entende são `excludeGroupMessages` e `excludeBroadcast` (booleans), conforme já provado pela `setupWebhook` que vinha funcionando antes.

### Mudanças em `supabase/functions/whatsapp-qr/index.ts` (função `reinforceWebhook`)

**1. Forçar `enabled: true` no payload**
```json
{
  "url": "<chatbot>",
  "events": ["messages"],
  "enabled": true,
  "excludeGroupMessages": true,
  "excludeBroadcast": true
}
```
Volta para os 2 booleans que essa versão da UAZAPI realmente respeita (mantendo grupos e broadcasts bloqueados na origem — memória `never-load-group-messages` 100% preservada).

**2. Verify mais rigoroso (GET /webhook)**
Considerar OK somente quando:
- `url === webhookUrl`
- `events` contém `messages`
- **`enabled === true`**

Se o GET retornar `enabled: false`, fazer **1 retry de POST** com o mesmo payload (resolve o caso onde a UAZAPI cria desabilitado por padrão na primeira chamada).

**3. Log claro do motivo da falha**
Quando o verify falhar, logar exatamente o que veio do GET (`enabled`, `events`, `excludeGroupMessages`) — facilita diagnóstico futuro sem precisar abrir UAZAPI.

**4. Aplicar a mesma correção em `setupWebhookAll`** (botão "Reparar X Webhooks" no Monitor de Envios) — adicionar `enabled: true` no payload para reparos manuais também garantirem ativação.

### Custo Lovable Cloud
**Zero adicional.** Continua disparando só na criação e na conexão (sem cron). A mudança é apenas no payload e na lógica de verificação.

### Memórias respeitadas
- ✅ `never-load-group-messages`: filtros `excludeGroupMessages` + `excludeBroadcast` (que comprovadamente funcionam nessa versão UAZAPI) mantidos
- ✅ `cloud-cost-awareness`: nenhuma execução nova

### Arquivos afetados
- `supabase/functions/whatsapp-qr/index.ts` — `reinforceWebhook` (payload com `enabled:true`, verify checa `enabled`, retry se vier desabilitado) e `setupWebhookAll` (mesmo payload)

### Como você testa depois
1. Desconecta a instância `IPHONE B1 22/04` e reconecta
2. Abre a UAZAPI → aba Webhooks dessa instância → o toggle deve já estar **azul/ativo** sem você tocar
3. Manda uma mensagem de teste do seu celular → chega no Inbox em até 30s

### Fora de escopo
- Não mexer no fluxo de envio
- Não recriar instâncias existentes (você usa o botão "Reparar Webhooks" do Monitor para corrigir as antigas com `enabled:false`)


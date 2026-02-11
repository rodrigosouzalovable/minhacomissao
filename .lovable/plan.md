
## Plano: Atualizar Credenciais da Integração Z-API

### Problema
As credenciais da Z-API precisam ser atualizadas com novos valores fornecidos pelo usuário.

### Valores Fornecidos
- **Instance ID**: 3ECC691777CBE1B941643A43AB49A453
- **Instance Token**: 4931031E1641E5FD2D3CAF8B
- **Client Token (Security Token)**: F221d74fcccd54113a38859a23505d69dS

### Impacto
Três funções backend dependem dessas credenciais:
1. `send-whatsapp` - Envia mensagens WhatsApp sob demanda
2. `process-whatsapp-queue` - Processa fila de mensagens agendadas
3. `daily-report-whatsapp` - Envia relatório diário automaticamente

### Solução
Atualizar os três secrets armazenados no projeto:
- `ZAPI_INSTANCE_ID` → `3ECC691777CBE1B941643A43AB49A453`
- `ZAPI_TOKEN` → `4931031E1641E5FD2D3CAF8B`
- `ZAPI_CLIENT_TOKEN` → `F221d74fcccd54113a38859a23505d69dS`

Esses secrets são acessados pelas edge functions via `Deno.env.get()` e são usados para:
- Construir a URL da API: `https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}/send-text`
- Autenticar requests com header `Client-Token`

### Resultado Esperado
- Credenciais atualizadas no backend
- Todas as três funções WhatsApp funcionando com os novos dados
- Mensagens sendo enviadas corretamente através da Z-API
- Relatório diário sendo entregue sem interrupções

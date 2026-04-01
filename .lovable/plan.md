

## Diagnóstico e Correção do Erro de Envio no Acionamento

### Problema Identificado

Os logs da edge function `send-whatsapp` mostram claramente:

```text
instance: "global"           ← nenhuma instância UAZAPI foi passada
Resposta: 401 Invalid token  ← o token global está expirado/inválido
```

**Causa raiz**: Nenhuma instância WhatsApp marcada como "Robô" e conectada foi encontrada. Quando isso acontece, a função cai no fallback usando os secrets globais (`UAZAPI_INSTANCE_TOKEN`), cujo token está inválido.

Dois problemas simultâneos:
1. **Token global expirado** — o secret `UAZAPI_INSTANCE_TOKEN` armazenado não é mais aceito pela UAZAPI
2. **Sem fallback claro para o usuário** — quando não há instância ativa do tipo "Robô", o sistema tenta silenciosamente com credenciais globais sem avisar

### Correções Propostas

#### 1. Melhorar feedback no Acionamento (`src/pages/Acionamento.tsx`)
- No `handleSend` e no `handleStartAutoSend`, **antes de enviar**, verificar se `activeInstances.length === 0` e mostrar um `toast.error` claro: _"Nenhuma instância WhatsApp do tipo Robô está conectada. Conecte uma instância antes de enviar."_ e interromper o envio.
- Isso evita envios silenciosos com credenciais globais inválidas.

#### 2. Otimizar endpoints na edge function (`supabase/functions/send-whatsapp/index.ts`)
- Reordenar os endpoints para tentar `/send/text` primeiro (o único que funciona), seguido dos outros como fallback.
- Isso reduz latência e logs desnecessários.

#### 3. Melhorar mensagem de erro na edge function
- Quando todos os endpoints falham com "Invalid token", retornar uma mensagem mais clara: _"Token UAZAPI inválido. Verifique as credenciais da instância."_

### Sobre o token global
O secret `UAZAPI_INSTANCE_TOKEN` precisa ser atualizado com um token válido. Após a implementação, vou solicitar a atualização do secret se necessário. Porém, com a correção #1, o sistema não tentará mais usar credenciais globais no acionamento — exigirá uma instância Robô conectada.


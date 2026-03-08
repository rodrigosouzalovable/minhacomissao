

# Delay randomizado + indicador "digitando" no chatbot WhatsApp

## Objetivo
Antes de enviar cada resposta, o chatbot aguarda 15-30 segundos (randomizado) e exibe o indicador "digitando..." no WhatsApp do cliente, simulando comportamento humano.

## Simulação de digitação (UAZAPI)

A UAZAPI expõe o endpoint `/chat/presence` (ou `/message/chatState`) para definir o estado "composing" (digitando). O chatbot chamará esse endpoint antes de enviar a mensagem.

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Nova função `simulateTyping`
```typescript
async function simulateTyping(serverUrl: string, instanceToken: string, telefone: string, durationMs: number) {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  // Ativa "digitando..."
  const endpoints = [
    `${cleanUrl}/chat/presence`,
    `${cleanUrl}/chatState`,
  ];
  for (const url of endpoints) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instanceToken },
        body: JSON.stringify({ number: telefone, state: 'composing' }),
      });
      break; // sucesso, não tenta próximo
    } catch {}
  }
  // Aguarda a duração
  await new Promise(r => setTimeout(r, durationMs));
}
```

### 2. Delay randomizado + typing antes do envio (linha ~835)

Onde hoje está:
```typescript
if (resposta) {
  await sendMessage(serverUrl, instanceToken, telefone, resposta);
}
```

Será:
```typescript
if (resposta) {
  const delayMs = (Math.floor(Math.random() * 16) + 15) * 1000; // 15-30 seg
  console.log(`Simulando digitação por ${delayMs/1000}s...`);
  await simulateTyping(serverUrl, instanceToken, telefone, delayMs);
  await sendMessage(serverUrl, instanceToken, telefone, resposta);
}
```

## Resultado
- O cliente verá "digitando..." por 15-30 segundos antes de cada resposta
- Se o endpoint de presença não existir na versão do UAZAPI, o delay ainda funciona (silently fails)
- Nenhuma mudança no banco de dados


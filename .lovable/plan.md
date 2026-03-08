

# Fix: Chatbot ignora mensagens enviadas manualmente (fromMe)

## Problema
O usuário envia a mensagem inicial manualmente ("Olá Rodrigo, você consegue voltar a pagar...") pelo Acionamento. O cliente responde "Sim". Mas a conversa no banco está no estado `acordo_finalizado` de uma interação anterior. O chatbot cai no case de estados finais (linha 611) e responde "Para uma nova consulta, digite menu".

O chatbot **ignora** mensagens `fromMe` (linha 206), então nunca sabe que você enviou a proposta manualmente.

## Solução

Duas mudanças no `supabase/functions/whatsapp-chatbot/index.ts`:

### 1. Rastrear mensagens fromMe como contexto
Quando uma mensagem `fromMe` chega e contém padrões como "50% de desconto" ou "parcelas em aberto", o chatbot deve:
- Buscar o devedor pelo telefone de destino
- Calcular os valores (à vista 50%, parcelado 30%)
- Setar o estado da conversa para `proposta_enviada` com todos os dados

Isso garante que quando o cliente responder "Sim", o chatbot está na etapa correta.

### 2. Estados finais devem resetar em mensagens relevantes
Quando a conversa está em `acordo_finalizado`/`sem_debitos` e o cliente envia algo que parece uma resposta positiva (sim, consigo, etc), em vez de dar o menu genérico, resetar para `novo` e reprocessar — assim o chatbot identifica o cliente pelo telefone e recomeça o fluxo.

### Mudança concreta no código

**Bloco fromMe (substituir o return simples por lógica de tracking):**
```typescript
if (isFromMe) {
  // Track outbound proposals to set conversation state
  const textoLower = texto.toLowerCase();
  if (textoLower.includes('50% de desconto') || textoLower.includes('parcelas em aberto')) {
    // Find debtor by destination phone, calculate values, save as proposta_enviada
    ...
  }
  return Response... // Still don't generate a reply for fromMe
}
```

**Bloco de estados finais (adicionar reset automático):**
```typescript
case 'acordo_finalizado':
case 'sem_debitos':
case 'gerando_boleto': {
  // If client sends something meaningful, restart the flow
  if (!['menu', 'inicio'].includes(textoLower)) {
    etapaAtual = 'novo';
    dados = { mensagens_historico: dados.mensagens_historico || [] };
    // Re-run the 'novo' case logic (identify by phone, etc.)
    ...
    break;
  }
  resposta = `Para uma nova consulta, digite "menu"...`;
  ...
}
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`


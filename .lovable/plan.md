

# Plano: Pausar Bot Quando Operador Estiver Respondendo Manualmente

## Problema

Quando você responde um cliente manualmente pelo WhatsApp, o bot continua respondendo automaticamente às mensagens do cliente, causando interferência. A imagem mostra exatamente isso: o bot enviou "Olá, sou a Ana..." e pediu CPF enquanto você já estava conversando com o cliente.

## Solução: Estado `atendimento_humano` com expiração automática

Quando uma mensagem `fromMe` é detectada (você digitou manualmente no WhatsApp), o bot colocará a conversa em estado `atendimento_humano`. Nesse estado, o bot **ignora completamente** as mensagens do cliente. O estado expira automaticamente após **30 minutos** sem novas mensagens manuais.

## Alterações

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Ao detectar `fromMe` (linhas ~466-605)
Além da lógica existente, **sempre** marcar a conversa como `atendimento_humano`:
```typescript
// Qualquer mensagem manual → pausar bot por 30 min
await supabaseFm.from('chatbot_conversas').upsert({
  telefone: destinoTelefone,
  etapa: 'atendimento_humano',
  dados: {
    ...(convExistente?.dados || {}),
    atendimento_humano_em: new Date().toISOString(),
    etapa_antes_humano: convExistente?.etapa || 'novo',
  },
  atualizado_em: new Date().toISOString(),
}, { onConflict: 'telefone' });
```

### 2. No início do processamento de mensagens do cliente (após linha ~649)
Antes de processar qualquer mensagem, verificar se está em `atendimento_humano`:
```typescript
if (conversa?.etapa === 'atendimento_humano') {
  const inicioAtendimento = new Date(conversa.dados?.atendimento_humano_em);
  const minutosDecorridos = (Date.now() - inicioAtendimento.getTime()) / 60000;
  
  if (minutosDecorridos < 30) {
    // Bot silenciado - operador está atendendo
    console.log(`[SILENCED] Bot pausado para ${telefone} (atendimento humano há ${Math.round(minutosDecorridos)}min)`);
    return Response; // ignora
  }
  
  // Expirou → restaurar etapa anterior e continuar processamento normal
  const etapaAnterior = conversa.dados?.etapa_antes_humano || 'novo';
  // Atualizar e prosseguir normalmente
}
```

### 3. Cada nova `fromMe` renova o timer
Se você enviar outra mensagem manual durante os 30 minutos, o timer recomeça. Isso garante que enquanto você estiver ativo na conversa, o bot não interfere.

## Resultado Esperado

- Você envia mensagem manual → bot para por 30 minutos
- Cliente responde → bot ignora (você está atendendo)
- Você envia outra mensagem → timer renova mais 30 minutos
- 30 minutos sem atividade manual → bot volta a funcionar normalmente


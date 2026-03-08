

# Evitar respostas duplicadas quando cliente envia múltiplas mensagens seguidas

## Problema
Quando o cliente envia "Olá tudo bem?" e "Como fica o valor?" quase ao mesmo tempo, o webhook UAZAPI dispara duas chamadas simultâneas da edge function. Ambas leem o mesmo estado (`proposta_enviada`), processam independentemente, e enviam duas respostas:
1. "Olá tudo bem?" → detectada como saudação → `isSim` → envia oferta e muda para `oferta_valores`
2. "Como fica o valor?" → processada antes da primeira terminar, ainda lê `proposta_enviada` → também `isSim` → envia outra oferta

## Solução: Debounce com buffer de mensagens

### 1. Migração: adicionar coluna de buffer na tabela `chatbot_conversas`
```sql
ALTER TABLE chatbot_conversas 
ADD COLUMN IF NOT EXISTS mensagens_pendentes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ultimo_webhook_em timestamptz;
```

### 2. Lógica de debounce no início do `whatsapp-chatbot/index.ts` (após extrair `texto` e `telefone`, antes de processar)

**Passo 1** — Ao receber mensagem, em vez de processar imediatamente:
- Fazer `UPDATE chatbot_conversas SET mensagens_pendentes = array_append(mensagens_pendentes, texto), ultimo_webhook_em = now()` (ou INSERT se não existir)

**Passo 2** — Esperar **4 segundos** (tempo para mensagens seguidas chegarem)

**Passo 3** — Ler novamente `chatbot_conversas`. Se `ultimo_webhook_em` é mais recente que nosso registro inicial, significa que outra mensagem chegou depois — **retornar sem processar** (o webhook mais recente cuidará)

**Passo 4** — Se somos o webhook mais recente: pegar todas as `mensagens_pendentes`, limpar o array atomicamente, concatenar os textos com `\n`, e processar como uma única mensagem

### 3. Lógica simplificada em pseudocódigo
```typescript
// Após extrair texto e telefone:
const agora = new Date().toISOString();

// Append message to buffer
await supabase.from('chatbot_conversas').upsert({
  telefone,
  mensagens_pendentes: supabase.rpc(...), // array_append
  ultimo_webhook_em: agora,
}, { onConflict: 'telefone' });

// Wait for more messages
await new Promise(r => setTimeout(r, 4000));

// Re-read
const { data: conv } = await supabase.from('chatbot_conversas')
  .select('ultimo_webhook_em, mensagens_pendentes')
  .eq('telefone', telefone).single();

// If a newer webhook arrived, let it handle
if (conv.ultimo_webhook_em > agora) {
  return Response({ success: true, deferred: true });
}

// We're the latest — claim all pending messages
const textosCombinados = conv.mensagens_pendentes.join('\n');
await supabase.from('chatbot_conversas')
  .update({ mensagens_pendentes: [] })
  .eq('telefone', telefone);

// Use textosCombinados as the `texto` for processing
texto = textosCombinados;
```

Como a coluna `mensagens_pendentes` é um array e `ultimo_webhook_em` é um timestamp, a comparação de timestamps garante que apenas o último webhook processa tudo. As mensagens anteriores são descartadas gracefully.

### Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

### Migração necessária
- Adicionar colunas `mensagens_pendentes` e `ultimo_webhook_em` em `chatbot_conversas`


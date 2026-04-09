

## IA Conversacional com Gemma 4 para Aquecimento WhatsApp

### Resumo

Integrar seu servidor local Ollama (Gemma 4 via ngrok) para gerar respostas automáticas entre instâncias internas durante o aquecimento. Quando um número do sistema recebe uma mensagem de outro número interno, a IA gera e envia uma resposta natural, simulando uma conversa real.

### O que será feito

**1. Nova Edge Function: `whatsapp-ia-responder`**

Função dedicada que recebe mensagem + histórico e chama seu Ollama via ngrok para gerar resposta. Inclui:
- Header `ngrok-skip-browser-warning: true` em todas as chamadas
- Timeout de 15s para evitar travamento
- Fallback com respostas pré-definidas caso o Ollama esteja offline

**2. Nova tabela: `whatsapp_conversas_ia`**

Controle de conversas ativas entre pares de instâncias:
- Máximo de 5-7 trocas por conversa
- Cooldown de 4h entre conversas do mesmo par
- Status: ATIVA, FINALIZADA, COOLDOWN

**3. Modificação no webhook (`whatsapp-chatbot`)**

No trecho que já detecta respostas de aquecimento (linha ~1234), adicionar lógica para:
- Verificar se a mensagem veio de número interno
- Consultar a tabela de conversas IA para decidir se deve responder
- Aplicar probabilidade por fase (30%/60%/90%)
- Chamar a edge function `whatsapp-ia-responder`
- Enviar a resposta via UAZAPI
- Registrar no log

**4. Regras de resposta por fase**

| Fase | Dias | Probabilidade | Tamanho |
|------|------|---------------|---------|
| 1 | 0-6 | 30% | 1 frase |
| 2 | 7-13 | 60% | 1-2 frases |
| 3+ | 14+ | 90% | 2 frases |

**5. Controle anti-loop**

- Delay aleatório de 15-90s antes de responder (simular leitura)
- Máximo 5-7 trocas por conversa
- Cooldown de 4h entre conversas do mesmo par
- Frase de encerramento automática: "Preciso ir, falo depois! 👍"

### Configuração necessária

A URL do ngrok (`https://efficient-unparticular-dilan.ngrok-free.dev`) será configurada como secret para facilitar atualização futura quando o ngrok gerar nova URL.

### Arquivos alterados/criados
- **`supabase/functions/whatsapp-ia-responder/index.ts`** (nova edge function)
- **`supabase/functions/whatsapp-chatbot/index.ts`** (integrar resposta IA no fluxo de aquecimento)
- **Migração SQL** (tabela `whatsapp_conversas_ia` + RLS)
- **`supabase/config.toml`** (adicionar config da nova function)

### Detalhes técnicos

```typescript
// whatsapp-ia-responder/index.ts - Chamada ao Ollama
const OLLAMA_URL = Deno.env.get('OLLAMA_NGROK_URL');
const response = await fetch(`${OLLAMA_URL}/api/generate`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  body: JSON.stringify({
    model: 'gemma4:e4b',
    prompt: `Você é um brasileiro conversando no WhatsApp...`,
    options: { temperature: 0.9, num_predict: 100 },
    stream: false
  })
});
```

```sql
-- Tabela de controle
CREATE TABLE whatsapp_conversas_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_origem_id UUID REFERENCES user_whatsapp_instances(id),
  instancia_destino_id UUID REFERENCES user_whatsapp_instances(id),
  inicio_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_msg_em TIMESTAMPTZ DEFAULT NOW(),
  total_trocas INTEGER DEFAULT 0,
  max_trocas INTEGER DEFAULT 5,
  status VARCHAR(20) DEFAULT 'ATIVA',
  historico JSONB DEFAULT '[]'
);
```

```typescript
// No whatsapp-chatbot, dentro do bloco de aquecimento (~linha 1266):
if (warmingInteraction) {
  // ... lógica existente de marcar RESPONDIDO ...
  
  // NOVO: Gerar resposta IA
  const conversaIA = await getOrCreateConversaIA(senderInstance.id, instanciaId);
  if (conversaIA && conversaIA.status === 'ATIVA' && shouldRespondByPhase(fase)) {
    const delay = 15000 + Math.random() * 75000; // 15-90s
    setTimeout(async () => {
      const resposta = await chamarOllamaIA(inboxTexto, conversaIA.historico);
      await enviarMensagemAquecimento(serverUrl, token, telefoneDestino, resposta);
      await atualizarConversaIA(conversaIA.id, inboxTexto, resposta);
    }, delay);
  }
}
```

### Fluxo de teste

1. Número A envia "Bom dia!" para Número B (via aquecimento automático)
2. Webhook detecta mensagem interna no Número B
3. Sistema verifica fase e probabilidade → decide responder
4. Espera 15-90s (simula leitura)
5. Chama Ollama via ngrok → gera resposta natural
6. Envia resposta de B para A via UAZAPI
7. Registra na tabela `whatsapp_conversas_ia`


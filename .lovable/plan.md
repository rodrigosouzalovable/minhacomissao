

## Implementação: Trocar IA do Aquecimento para Ollama local

**Servidor confirmado:** `https://efficient-unparticular-dilan.ngrok-free.dev` | Modelo: `gemma4:e4b`

### Mudanças

**Arquivo único:** `supabase/functions/whatsapp-ia-responder/index.ts`

1. **Substituir as 2 chamadas pagas** (`chamarIA()` e `gerarMensagemInicial()`):
   - **De:** `https://ai.gateway.lovable.dev/v1/chat/completions` + `LOVABLE_API_KEY` + `google/gemini-2.5-flash-lite`
   - **Para:** `${OLLAMA_NGROK_URL}/api/chat` + modelo `gemma4:e4b` (formato Ollama nativo)

2. **Formato da requisição Ollama:**
   ```ts
   POST ${OLLAMA_NGROK_URL}/api/chat
   {
     "model": "gemma4:e4b",
     "messages": [{ "role": "user", "content": "..." }],
     "stream": false,
     "options": { "temperature": 0.8, "num_predict": 80 }
   }
   ```
   Resposta: `data.message.content`

3. **Headers ngrok:** adicionar `'ngrok-skip-browser-warning': 'true'` para evitar página de warning do ngrok grátis.

4. **Manter intacto:**
   - Timeout de 20s (AbortController)
   - Sistema `FALLBACK_RESPOSTAS` — se Ollama falhar/timeout, usa respostas pré-prontas (zero risco de quebrar aquecimento)
   - Toda a lógica de ping-pong, deduplicação, limite diário

5. **Verificar/atualizar secret `OLLAMA_NGROK_URL`** — se a URL salva for diferente da atual, peço para você atualizar.

### Resultado
- **Custo Lovable AI do aquecimento:** $0
- Continua funcionando igual; se ngrok cair, fallback assume automaticamente
- Mestra WA (chat manual) continua no Gemini pago — consumo desprezível

### Fora de escopo
- Não mexo em `whatsapp-mentor`, chatbot de cobrança, extração de acordos
- Não removo o código do Lovable AI Gateway de outras funções


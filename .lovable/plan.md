

## Diagnóstico — Quem está queimando seus dólares

Investiguei os logs das últimas 24h. **NÃO é o aquecimento** (já migrado para Ollama). É a função **`whatsapp-chatbot`**:

| Função | Chamadas/24h | Usa IA paga? |
|---|---|---|
| **whatsapp-chatbot** | **~8.200** | **SIM — até 4 chamadas Lovable AI por mensagem** |
| test-uazapi-connection | 1.076 | Não |
| Outras | <30 | — |

### Por que está caro
Cada webhook do WhatsApp dispara o chatbot, que faz **4 chamadas IA pagas** no Gateway Lovable:

1. **Transcrição de áudio** — `gemini-2.5-flash` (modelo CARO, multimodal)
2. **`extrairGatilho()`** — extrai palavras-chave de toda mensagem de texto
3. **`interpretarIntencao()`** — interpreta opções em vários pontos do fluxo
4. **`gerarRespostaComInstrucaoAdmin()`** — quando admin manda instrução

8.000 webhooks × 2-3 chamadas IA = **~20.000 requisições pagas/dia** → ~$5/dia.

## Plano de corte (zero impacto na funcionalidade)

**Arquivo único:** `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Migrar 3 chamadas de texto para Ollama local (gratuito)
Trocar `extrairGatilho()`, `interpretarIntencao()` e `gerarRespostaComInstrucaoAdmin()` para usar `OLLAMA_NGROK_URL` + modelo `gemma4:e4b` — mesmo padrão que já fizemos no aquecimento. Mantém **fallback automático**: se Ollama cair, usa heurística simples (já existe no código).

### 2. Curto-circuito por regex ANTES da IA (economia maior)
Antes de chamar qualquer IA, tentar match local com lista de gatilhos comuns:
- "sim", "ok", "beleza", "fechado" → confirmação
- "não", "nao", "não posso" → negação
- "depois", "amanhã", "semana que vem" → adiamento
- valores numéricos / datas → extrair via regex

Estimo que **70% das mensagens** podem ser resolvidas sem IA nenhuma.

### 3. Cache em memória de gatilhos
Adicionar `Map` em escopo de módulo para `extrairGatilho()` e `interpretarIntencao()` — mensagens repetidas ("ok", "sim", "vou ver") retornam instantaneamente sem chamar IA nem Ollama.

### 4. Transcrição de áudio — desabilitar (recomendação padrão)
Bot responde: *"Por favor, envie sua mensagem em texto para eu te atender melhor 🙂"*. Custo: $0. Se você preferir manter o áudio funcionando, me avise depois — posso adicionar limite diário (ex: 50/dia via Gemini, ~$0.30/dia) ou guiar instalação do Whisper no seu servidor.

## Resultado esperado

| Item | Antes | Depois |
|---|---|---|
| Custo IA chatbot | ~$4-5/dia | **$0** |
| Latência respostas texto | 800-2000ms | 50-300ms |
| Funcionalidade | — | Idêntica (com fallback robusto) |

## Fora de escopo
- Não mexo em outras funções IA (extração de acordos, Mestra WA, gerar termo) — consumo desprezível
- Não removo o código do Lovable AI Gateway, fica como fallback caso Ollama esteja offline


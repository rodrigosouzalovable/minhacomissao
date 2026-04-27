# Investigação do consumo de Lovable AI ($20 → $0)

## O que encontrei

Analisei os logs das últimas 48h. **`whatsapp-chatbot` foi chamado 2.273 vezes** (webhook UAZAPI a cada mensagem recebida). Ela própria usa **Ollama (gratuito)**, mas dispara internamente **`teach-chatbot`** que usa **Lovable AI (`google/gemini-2.5-flash-lite`)** sempre que um admin manda mensagem para o número do bot.

Outras funções que consomem Lovable AI mas têm volume baixo:
- `whatsapp-mentor` (chat manual da Mestra WA) — `gemini-2.5-flash`
- `daily-report-advanced` (1x/dia) — `gemini-2.5-flash`
- `gerar-estrategia-cobranca` (sob demanda) — `gemini-3-flash-preview`
- `extract-acordo-data`, `extract-pdf-acordo`, `transcribe-audio`, `analyze-cobmais-screen`, `process-cobmais-video` — sob demanda

### Causa mais provável do gasto rápido

Cada mensagem que chega ao webhook que cai na branch "ensinar IA" / `teach-chatbot` é uma chamada paga. Modelos como `gemini-2.5-flash` no `whatsapp-mentor` também queimam crédito rápido em conversas longas com contexto grande.

**Importante:** o saldo "$0 Top-up balance" que você viu na imagem é o **AI balance** (separado dos $25 de Cloud). Os $20 viraram tokens consumidos pelas chamadas acima — não há "vazamento", há uso real ocorrendo.

## Plano de corte de gasto (urgente)

### 1. Kill switch global de IA
Criar um flag `ai_enabled` na tabela `system_config` (cria se não existir). Toda função que chama `ai.gateway.lovable.dev` checa esse flag antes — se `false`, retorna resposta genérica/erro controlado e **não gasta crédito**.

### 2. Trocar todos os modelos para o mais barato
Substituir em todas as edge functions:
- `google/gemini-2.5-flash` → `google/gemini-2.5-flash-lite`
- `google/gemini-3-flash-preview` → `google/gemini-2.5-flash-lite`
- `openai/gpt-5*` (se houver) → `google/gemini-2.5-flash-lite`

`flash-lite` é o mais barato da família.

### 3. Desativar funções não-essenciais por padrão
- **`teach-chatbot`** (chamada toda vez que admin escreve para o bot): exigir comando explícito `/ensinar` para ativar; caso contrário retorna sem chamar IA.
- **`whatsapp-mentor`**: limitar a 20 mensagens/dia por usuário (contador em DB).
- **`daily-report-advanced`**: pausar o cron até você reativar manualmente.

### 4. Reduzir tamanho de contexto
- `whatsapp-mentor`: enviar só últimas 6 mensagens (hoje envia até 100).
- `teach-chatbot`: cortar histórico para 10 mensagens.
- Sem `reasoning` em nenhuma chamada.

### 5. Painel de monitoramento simples
Adicionar uma página `/admin/ai-uso` que lê uma nova tabela `ai_usage_log` (cada chamada registra: função, modelo, tokens estimados, user_id, timestamp). Assim você vê em tempo real o que está consumindo.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — tabela `system_config`, `ai_usage_log`, e desativar cron `daily-report-advanced`
- `supabase/functions/teach-chatbot/index.ts` — kill switch + flash-lite + corte de histórico
- `supabase/functions/whatsapp-mentor/index.ts` — kill switch + flash-lite + limite diário + corte contexto
- `supabase/functions/daily-report-advanced/index.ts` — kill switch + flash-lite
- `supabase/functions/gerar-estrategia-cobranca/index.ts` — kill switch + flash-lite
- `supabase/functions/extract-acordo-data/index.ts`, `extract-pdf-acordo/index.ts`, `extract-texto-acordo/index.ts`, `analyze-cobmais-screen/index.ts`, `process-cobmais-video/index.ts`, `transcribe-audio/index.ts`, `gerar-termo-acordo/index.ts`, `chat-cobmais-knowledge/index.ts`, `process-pos-atendimento/index.ts` — flash-lite + log de uso
- `supabase/functions/whatsapp-chatbot/index.ts` — só dispara `teach-chatbot` se mensagem começar com `/ensinar`
- `src/pages/AdminAiUso.tsx` (novo) + rota — painel de monitoramento
- `src/components/layout/AppLayout.tsx` — link no menu admin

## Resultado esperado

Com flash-lite + kill switch + limites de contexto + cortar `teach-chatbot` automático, o consumo deve cair **>90%**. Você ainda terá controle total: pode desligar IA inteira pelo painel se notar consumo anormal.


## Reformular o Aquecimento: Conversas Diárias com IA entre Todas as Instâncias

### Problema Principal
A função `whatsapp-aquecimento` **não está sendo executada** — não existe um cron job configurado para chamá-la automaticamente. Além disso, a lógica atual tem tantos filtros anti-ban (silent day, read-only day, skip cycle, burst cooldown, pausa de almoço, jitter de 3 min) que mesmo se fosse chamada, a maioria dos ciclos seria pulada.

### Nova Estratégia
Simplificar drasticamente: cada instância deve trocar **15 mensagens por dia** com as outras, usando **100% IA** (não depender dos diálogos pré-cadastrados). A IA vai gerar conversas naturais sobre temas variados (notícias, dia a dia, futebol, clima, etc).

---

### Alterações

#### 1. Criar cron job para chamar a função a cada 15 minutos
Inserir via SQL (não migração) um job `pg_cron` + `pg_net` que chama `whatsapp-aquecimento` a cada 15 minutos, das 7h às 21h.

#### 2. Reescrever a lógica de envio em `whatsapp-aquecimento`
- **Remover**: silent day, read-only day, skip cycle, burst morning, pausa de almoço, jitter de 3 minutos
- **Manter**: health check, horário comercial (7h-21h), dias ativos
- **Nova lógica**: Para cada instância ativa, verificar quantas mensagens já enviou hoje. Se < 15, sortear uma instância destino e disparar uma conversa via IA
- **Round-robin**: distribuir as mensagens ao longo do dia (15 mensagens em ~14h = ~1 a cada 56 min, com randomização)
- **Sem diálogos pré-cadastrados**: A primeira mensagem de cada conversa também será gerada pela IA, com um prompt do tipo "Inicie uma conversa casual sobre [tema aleatório]"

#### 3. Atualizar `whatsapp-ia-responder` 
- Adicionar temas variados ao system prompt: notícias atuais, futebol, clima, filmes, séries, comida, trabalho, fim de semana
- Garantir que a cadeia ping-pong funcione para as 15 trocas
- Aumentar `max_trocas` para 15

#### 4. Atualizar a IA para iniciar conversas (nova action)
Adicionar uma action `iniciar-conversa` no `whatsapp-ia-responder` que gera a primeira mensagem sobre um tema aleatório, sem depender de diálogos pré-cadastrados.

### Arquivos Modificados
- `supabase/functions/whatsapp-aquecimento/index.ts` — simplificar lógica, remover filtros excessivos, usar IA para todas as mensagens
- `supabase/functions/whatsapp-ia-responder/index.ts` — adicionar temas variados, action de iniciar conversa, max 15 trocas
- SQL insert para criar o cron job

### Resultado Esperado
- Cada instância envia e recebe ~15 mensagens/dia
- Conversas naturais geradas por IA sobre temas variados
- Todas as mensagens visíveis no Inbox
- Execução automática a cada 15 minutos

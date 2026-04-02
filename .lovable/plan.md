

## Cálculo e Explicação

**Fórmula**: Horário comercial = 8h às 18h = 10 horas = 36.000 segundos. Com round-robin, cada número envia `total_msgs / qtd_numeros` mensagens. Para limitar a 30 msgs/dia por número:

```text
Total de msgs permitidas = 30 × qtd_números_robô
Intervalo médio = 36.000 / total_msgs_permitidas (em segundos)

Exemplo: 3 números robô → 90 msgs/dia → intervalo médio = 400s (6min40s)
         Min: ~330s, Max: ~470s (variação de ±20%)
```

### Funcionalidades a implementar

**1. Cálculo automático do intervalo**
- Na área de "Envio automático" em `src/pages/Acionamento.tsx`, adicionar um botão "Calcular" ao lado dos campos min/max
- Ao clicar, calcular baseado em: `qtd_números_robô` (já disponível via `activeInstances.length`) e limite de 30 msgs/dia/número
- Fórmula: `intervaloMedio = 36000 / (30 * activeInstances.length)`, min = `intervaloMedio * 0.8`, max = `intervaloMedio * 1.2`
- Preencher automaticamente os campos min/max
- Exibir tooltip/texto informativo: "~30 msgs/número/dia (8h-18h)"

**2. Agendamento de envio automático (envio programado)**
Permitir agendar o envio para iniciar automaticamente no dia seguinte às 8h.

- **Nova tabela** `acionamento_agendamentos`: `id`, `user_id`, `historico_id`, `mensagens` (jsonb), `agendado_para` (timestamptz), `status` (pendente/executando/concluido/cancelado), `min_sec`, `max_sec`, `created_at`
- **Nova edge function** `process-acionamento-agendado`: executada via cron a cada minuto, verifica agendamentos pendentes com `agendado_para <= now()`, processa o envio server-side (busca clientes do histórico, faz round-robin nas instâncias robô do usuário, envia com delay)
- **UI**: Adicionar botão "Agendar envio" na página de Acionamento que permite escolher data/hora de início. Exibir agendamentos pendentes com opção de cancelar.

### Arquivos alterados
- `src/pages/Acionamento.tsx` — botão calcular intervalo + UI de agendamento
- `supabase/functions/process-acionamento-agendado/index.ts` — nova edge function
- Nova migração para tabela `acionamento_agendamentos` + cron job

### Seção técnica

O cálculo automático é simples e local (sem backend). O agendamento requer processamento server-side porque o usuário não estará com o sistema aberto. A edge function reutilizará a lógica de `send-whatsapp` existente com round-robin entre instâncias marcadas como robô do usuário.


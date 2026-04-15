

## Estratégia de Aquecimento Natural — Comportamento Humano Realista

### Implementação atual (v3)

#### whatsapp-ia-responder
- **Conversas curtas**: `max_trocas` = 4-8 (era 12-18)
- **Delays humanizados**: distribuição variada (5s-10min) em vez de 30-60s fixo
  - 30% rápido (5-15s), 40% normal (30-90s), 20% lento (2-5min), 10% muito lento (5-10min)
- **Typing indicator**: "digitando..." enviado antes de cada mensagem
- **Mídia**: ~20% chance de áudio/imagem por mensagem

#### whatsapp-aquecimento
- **Variação diária**: 20% sem conversa, 60% 1 conversa, 20% 2 conversas
- **Skip aleatório**: 50% chance de pular cada execução do cron
- **Pares com afinidade**: 30% preferência por repetir último parceiro
- **Max 3 pares por ciclo** do cron
- **Delay entre pares**: 30-120s
- **Auto-enrollment** de instâncias ativas
- **Pausa apenas** em desconexão real (falha de envio)

### Cron
- `0 10-23 * * *` (horário, 14x/dia)
- Skip aleatório + variação diária = ~32 conversas/dia distribuídas naturalmente



# Melhorias de Segurança Anti-Restrição do Aquecimento

## O que já está implementado
- Carência de 2 dias para novos números
- Apenas 1 instância por ciclo de 15 min
- Pausa automática com taxa de falha > 15%
- Horário comercial e dias ativos

## Problemas restantes identificados

### 1. Status é postado para TODAS as instâncias no mesmo ciclo
O bloco de status (linha 459) itera **todas** as instâncias, não respeita o limite de 1 por ciclo. Se 20 números estão ativos, todos podem postar status no mesmo ciclo — comportamento antinatural.

### 2. Sem variação de horário entre instâncias
Todas as instâncias operam no mesmo horário exato. Humanos reais não começam e param todos ao mesmo tempo.

### 3. Sem limite de interações recebidas por destino
Um número pode receber mensagens de muitas instâncias diferentes no mesmo dia, o que é suspeito.

### 4. Fase 1 permite 3 mensagens/dia — ainda alto para número novo
Números com 2-7 dias deveriam enviar no máximo 1-2 mensagens/dia.

### 5. Sem detecção de desconexão/ban
Se um número é banido, o sistema continua tentando enviar e acumulando falhas.

---

## Plano de implementação

### Mudança 1 — Limitar status a 1 instância por ciclo
**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`

No bloco de status (linha 452-610), selecionar apenas 1 instância aleatória elegível ao invés de iterar todas, igual já fazemos para mensagens.

### Mudança 2 — Offset aleatório por instância no horário
**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`

Usar o ID da instância para gerar um offset de ±60 minutos no horário de início/fim. Isso faz com que cada número "acorde" e "durma" em horários ligeiramente diferentes.

### Mudança 3 — Limite de recebimento por destino (max 3/dia)
**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`

Antes de selecionar o destino (linha 337), verificar quantas mensagens o destino já **recebeu** hoje. Se >= 3, pular esse destino.

### Mudança 4 — Reduzir limite da Fase 1 para 1 msg/dia
**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`

Alterar `PHASE_CONFIG[1].limite` de 3 para 1.

### Mudança 5 — Detectar ban/desconexão e pausar automaticamente
**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`

Antes de enviar, fazer um health check (`GET /instance/status`) na instância. Se retornar desconectado, pausar a instância e notificar.

### Mudança 6 — Configuração de carência editável no painel
**Arquivo:** `src/components/aquecimento/AquecimentoConfigTab.tsx`

Adicionar um campo na aba de configurações para o usuário definir quantos dias de carência (padrão 2), ao invés de fixo no código.

---

## Resumo

| Mudança | Arquivo | Impacto |
|---------|---------|---------|
| Status 1 instância/ciclo | `whatsapp-aquecimento/index.ts` | Evita burst de status |
| Offset aleatório no horário | `whatsapp-aquecimento/index.ts` | Padrão mais humano |
| Limite recebimento destino | `whatsapp-aquecimento/index.ts` | Evita número "bombardeado" |
| Fase 1 = 1 msg/dia | `whatsapp-aquecimento/index.ts` | Proteção números novos |
| Health check antes de enviar | `whatsapp-aquecimento/index.ts` | Detecta bans cedo |
| Carência configurável | `AquecimentoConfigTab.tsx` | Flexibilidade pro admin |


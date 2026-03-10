

# Plano: Botão "Start" para Lembretes + Status + Intervalo 5-7min

## O que será feito

Na seção "WhatsApp Principal para Lembretes" do dialog de Configurações WhatsApp, adicionar:

1. **Status visual** mostrando se os envios do dia:
   - **Não iniciados** — botão "Iniciar Envios" habilitado
   - **Em andamento** — badge "Enviando..." com progresso (X de Y)
   - **Finalizados** — badge "Concluído" com total enviado

2. **Botão "Iniciar Envios"** que chama a edge function `check-payment-reminders` para popular a fila do dia

3. **Intervalo de 5-7 minutos** (randomizado) entre cada mensagem

## Alterações

### 1. Edge function `check-payment-reminders/index.ts`
- Linha 211: mudar intervalo de `3 * 60 * 1000` para intervalo aleatório entre 5 e 7 minutos:
  ```typescript
  const intervaloMs = (Math.floor(Math.random() * 3) + 5) * 60 * 1000; // 5, 6 ou 7 min
  proximoHorario = new Date(proximoHorario.getTime() + intervaloMs);
  ```

### 2. UI em `src/pages/Acionamento.tsx`
Na seção "WhatsApp Principal para Lembretes" (após o Select, linha ~1471):

- Adicionar estado: `lembreteStatus` (`idle` | `loading` | `sending` | `done`), `lembreteStats` (`{ total, pendentes, enviados, erros }`)
- Ao abrir o dialog, consultar `whatsapp_fila` filtrando por `criado_em` de hoje para determinar o status:
  - Se não há registros hoje → `idle` (botão habilitado)
  - Se há pendentes → `sending` (em andamento)
  - Se todos enviados/erro → `done` (finalizado)
- Botão "Iniciar Envios" que faz `supabase.functions.invoke('check-payment-reminders')` e atualiza o status
- Exibir progresso: "X de Y enviados" com barra de progresso
- Polling a cada 30s enquanto status é `sending` para atualizar contadores

### 3. Nenhuma alteração no backend de processamento
A `process-whatsapp-queue` já processa a fila minuto a minuto — o intervalo randomizado entre 5-7min já será respeitado pelo `agendado_para` de cada item na fila.


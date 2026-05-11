## Objetivo
Ativar **apenas reações** (sem visualização e sem resposta privada) no engajamento de status entre as instâncias conectadas, e testar reagindo ao status que o **MEMU 37** acabou de postar (`msgId 3EB08681F233A4EA4392F6`).

## Diagnóstico do estado atual
- `engajamento_status_auto = false` → nenhum agendamento de interação foi criado para o status recém-postado (`whatsapp_aquecimento_status_interacoes` vazio para esse log).
- A função `agendarInteracoes` em `whatsapp-aquecimento-status` agenda 3 tipos: `visualizado`, `reacao`, `resposta`. Precisa ficar só `reacao`.
- A função `aquecimento-status-reagir` exige `autorPhone` para qualquer tipo (inclusive reação), mas a coluna `user_whatsapp_instances.telefone` está NULL em todas as instâncias. Reação na verdade é enviada para `status@broadcast`, não precisa do número do autor — basta o `whatsapp_msg_id`. Esse bloqueio precisa ser relaxado para `reacao`.
- Outros módulos (envio direto, conversa em grupo, ping-pong, perfil, descoberta, promoção) continuam pausados — sem alterações.

## Alterações
1. **Config**: upsert em `whatsapp_aquecimento_config`:
   - `engajamento_status_auto = true`

2. **Edge `whatsapp-aquecimento-status`** (função `agendarInteracoes`):
   - Pular criação das linhas `visualizado` e `resposta`. Manter só `reacao` (3-6 instâncias aleatórias, agendadas em 10-180 min).

3. **Edge `aquecimento-status-reagir`**:
   - Só checar `autorPhone` quando `tipo === 'visualizado' || tipo === 'resposta'`. Para `reacao` basta `msgId`.
   - Nada mais muda (limites diários de 8 reações/dia/instância, espaçamento, pool de emojis).

4. **Backfill de teste imediato**:
   - Selecionar 4 instâncias ativas aleatórias diferentes do MEMU 37.
   - Inserir 4 linhas em `whatsapp_aquecimento_status_interacoes` com `tipo='reacao'`, `status_log_id='c97ba772-5e2e-49da-93b3-eb38eb496e1a'`, `agendado_para = now()` (já vencido, para o cron pegar).
   - Invocar `aquecimento-status-reagir` com `{ action: "test" }` para ignorar janela e processar imediatamente.
   - Validar: `select tipo, sucesso, erro from whatsapp_aquecimento_status_interacoes where status_log_id = 'c97ba772-...'`. Esperado: 4 linhas com `sucesso=true` e emoji em `conteudo`.

## Validação pós-implementação
- Logs do `aquecimento-status-reagir` mostram `processed: 4` com `sucesso: true`.
- No celular MEMU 37, o status mostra 4 reações distintas (❤️/🔥/etc.) das outras instâncias.
- Para qualquer status novo postado depois, a função `whatsapp-aquecimento-status` agendará automaticamente 3-6 reações (sem visualização/resposta) que o cron `aquecimento-status-reagir` (rodando a cada 5 min, 08-21h, exceto domingo) executará.

## Reversão
- Para desligar de novo: `engajamento_status_auto = false`.
- Para reabilitar visualização/resposta: reverter o filtro em `agendarInteracoes` e o relaxamento em `aquecimento-status-reagir`.

## Custo
Praticamente zero: apenas 4 chamadas extras ao UAZAPI no teste. Em regime, 3-6 reações por status postado (~1 status a cada 48-72h por instância).

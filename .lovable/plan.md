# Conferir aprovação dos templates automaticamente

Hoje, quando você clica em "Aplicar template nessas instâncias", o sistema envia os modelos e uma rotina consulta a Meta a cada 30 minutos para atualizar o status. O que falta é o acompanhamento por número/modelo: saber quando cada um foi conferido pela última vez, parar de conferir assim que a Meta aprova (ou reprova) e não gastar consultas quando não há nada aguardando.

## O que muda

1. **Conferência só de quem está esperando**
   A verificação passa a olhar apenas os números que têm modelos aguardando resposta da Meta. Se nada estiver aguardando, a rotina encerra na hora, sem consultar a Meta — custo praticamente zero.

2. **Ritmo de conferência definido e decrescente**
   - Primeiras 3 horas após o envio: confere a cada 30 minutos (aprovação normalmente sai nesse período).
   - Depois disso: passa a conferir de hora em hora.
   - Depois de 48 horas sem resposta: conferência a cada 6 horas e aviso no WhatsApp de que o modelo está preso em análise.

3. **Para de conferir quando resolve**
   Assim que a Meta responde aprovado ou reprovado, aquele modelo naquele número sai da lista de conferência definitivamente e nunca é consultado de novo.

4. **Aviso e visão do progresso**
   - Quando todos os modelos de um número são aprovados, chega um aviso no WhatsApp (62991672674) informando o número, a BM e quantos modelos foram aprovados.
   - Na barra de progresso da injeção aparece "última conferência há X min" e "próxima conferência em X min", com o botão Atualizar já existente para conferir na hora.

5. **Todos os números sempre com os mesmos modelos**
   Uma vez por dia o sistema compara, número por número, os modelos marcados para injeção com os que cada número realmente tem aprovado na Meta, e coloca na fila apenas o que falta — sem repetir o que já existe. Assim as instâncias tendem a ficar idênticas sozinhas, sem você precisar clicar em nada.

6. **Respeita a qualidade do número**
   - Número com qualidade amarela ou vermelha (ou bloqueado na Meta) fica de fora: nada é injetado nele.
   - Assim que a qualidade volta ao verde, o próprio sistema reconfere o que está faltando naquele número e retoma a sincronização gradual, avisando no WhatsApp que voltou a sincronizar.


## Detalhes técnicos

- Migração em `meta_templates_instancia`: colunas `ultima_verificacao_em`, `proxima_verificacao_em`, `verificacoes` (int, default 0), com índice parcial em `proxima_verificacao_em` para status ainda em aberto (`PENDING`/`ENVIADO`).
- `meta-verificar-status-templates`:
  - passa a selecionar apenas itens em aberto com `proxima_verificacao_em <= now()` (ou nulo), limitados por lote (ex. 25 números por execução) — mantém o retorno imediato quando o conjunto é vazio;
  - após cada consulta à Graph API, grava `ultima_verificacao_em`, incrementa `verificacoes` e calcula `proxima_verificacao_em` pela escada 30min / 1h / 6h a partir de `enviado_em`;
  - ao gravar `APPROVED`/`REJECTED`, zera `proxima_verificacao_em` (fica nulo) para excluir o item das próximas rodadas;
  - dispara o aviso de "todos aprovados" por número usando `notificarAdmin` com chave de idempotência `templates_aprovados:<instancia_id>`.
- Cron: mantém o job 51 (`*/30 * * * *`) como único gatilho — ele já sai de imediato quando não há itens em aberto, então não é criado nenhum agendamento novo.
- `meta-templates-onboarding-tick` continua fechando os itens da fila a partir de `meta_templates_instancia`, sem mudança de lógica.
- Front-end: `TemplatesInjecaoProgresso.tsx` exibe os horários de última/próxima conferência a partir dos novos campos.

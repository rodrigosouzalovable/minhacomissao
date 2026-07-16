
## Problema identificado

Analisando a CSIM 4:

- **78 "enviados"** = a API da Meta aceitou o POST → o item foi marcado como `enviado` no job.
- **31 "Falharam na entrega"** = depois, via webhook, a Meta devolveu `status=failed` (ex.: `Business eligibility payment issue #131042`, o caso do `5592991447169`). Hoje esses casos **não voltam para a fila** — o job já considerou o item concluído no momento em que a API respondeu 200. Por isso a planilha só tem 46 entregues/aceitos: os 31 que caíram no webhook `failed` ficaram órfãos.
- Além disso, mesmo nas falhas da própria chamada da API (`send-whatsapp-meta` retornando `success:false`), hoje só reenfileiramos se a instância for **auto-bloqueada no primeiro erro** E ainda houver outra instância disponível — se sobrar só uma, o item vai direto para `erro`, sem tentar de novo.

## O que muda

### 1. Reenfileirar falhas de API imediatamente (não só quando a instância é bloqueada)

`supabase/functions/envio-meta-massa-tick/index.ts`

- Introduzir um contador `tentativas` por item (nova coluna) e uma constante `MAX_TENTATIVAS_ITEM = 3`.
- Quando `sendResp.success = false` (fora dos casos já tratados `tier_full/pool_blocked/pool_paused/blocked`):
  - Incrementar `tentativas` do item.
  - Se `tentativas < MAX_TENTATIVAS_ITEM` **e existir ao menos uma outra instância não-bloqueada no job**, devolver o item para `status='pendente'` (limpando `instancia_id/instancia_nome`) e forçar `excluir_id = instância que falhou` no próximo `pick-meta-instance` (já suportado).
  - Só marcar `status='erro'` quando estourar o teto ou não restar outra instância.
- Manter a auto-exclusão da instância após 1 falha (já existente) — isso e o retry do item são independentes.

### 2. Reenfileirar quando a Meta devolver `status=failed` pelo webhook

`supabase/functions/meta-whatsapp-webhook/index.ts`

Quando `status === 'failed'`, além do que já faz:

1. Localizar o `envio_meta_job_item` correspondente pelo `wa_message_id` já salvo em `meta_whatsapp_envios_log` (ou por sufixo do telefone + `job_id` associado ao log).
2. Se o item existir, pertencer a um job com `status IN ('rodando','pausado','concluido')` e `tentativas < MAX_TENTATIVAS_ITEM`:
   - Incrementar `tentativas`, limpar `instancia_id/instancia_nome/processado_em`, mudar `status` para `pendente`.
   - Decrementar `enviados` do job e, se o job já estava `concluido`, voltá-lo para `rodando` com `proximo_em = agora` e disparar `envio-meta-massa-tick` (self-invoke).
   - No próximo pick, o `ultima_instancia_id` do job já exclui quem acabou de falhar.
3. Se restrições da Meta bloquearam a instância (código nos `restrictedCodes` já mapeados) → a instância já entra em `estado_pool='restrita'` e o `pick-meta-instance` naturalmente vai escolher outra.

### 3. Coluna nova e link job_item ↔ envio_log

Migration:

- `envio_meta_job_item`: adicionar `tentativas int not null default 0` e `wa_message_id text` (indexado) para permitir o webhook achar o item sem depender de sufixo de telefone.
- No `send-whatsapp-meta` (ou no tick, após sucesso), preencher `wa_message_id` no item quando a Meta devolver o `messages[0].id`.

### 4. UI (`src/pages/EnvioMeta.tsx`)

- Mostrar a coluna "tentativas" no painel de detalhes quando > 1 ("2ª tentativa via LD 07").
- No resumo do job, separar visualmente:
  - **Aceitos pela API** (o que existe hoje como "enviados")
  - **Entregues** (webhook `delivered`)
  - **Recuperados por retry** (item com `tentativas > 1` que terminou como `delivered/read`)
  - **Falha definitiva** (item que estourou o teto de tentativas)
- Contadores do job (`enviados`, `erros`) passam a refletir o resultado após retries, não a 1ª tentativa.

### 5. Notificação final

Ajustar `notificarConclusao` para citar quantos itens foram recuperados por retry e quantos falharam em definitivo após N tentativas.

## Fora de escopo

- Não vamos mexer em templates, cobrança, escalonamento nem no aquecimento.
- Não vamos criar cron novo — o retry aproveita o próprio loop do tick e o self-invoke já existente (sem custo extra).
- Não mexemos em regras de round-robin, delay randomizado, filtro RED/YELLOW nem no bloqueio de domingo (tudo continua igual).

## Teste de verificação

Repetir uma campanha pequena com uma instância que sabidamente falha (ex.: `Business eligibility payment issue`). Esperado:

1. Chamada 1 → falha na API ou webhook devolve `failed`.
2. Item volta para `pendente`, `tentativas=1`.
3. Próximo tick pega outra instância (a que falhou é excluída via `excluir_id` + `instancias_bloqueadas_run`).
4. Se entregar, item finaliza como `enviado` com `tentativas=2` — aparece na planilha final como entregue.
5. Contador de "Falharam na entrega" no painel só inclui os que estouraram 3 tentativas.

## Alerta de custo

Mudança de baixo impacto: nenhum cron/polling novo. O único custo adicional é ~1 UPDATE + 1 self-invoke por item que falhar no webhook — proporcional ao volume de falhas, portanto marginal.

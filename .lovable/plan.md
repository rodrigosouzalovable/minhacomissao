
## Problema 1 — Instância ativa parou de enviar depois do template pausado

**Diagnóstico (confirmado no banco):**
- Job `ac33474f…` tem `instancias_bloqueadas: []`, mas 5 itens da instância `62 98265-1759` estão como `status='erro'` com a mensagem exata `(#132015) … is paused`.
- Se a lógica de `template_paused` tivesse sido executada no worker (`envio-meta-massa-burst`), esses itens teriam sido devolvidos para `pendente` (linha 317) e `instancias_bloqueadas` teria sido preenchida.
- Como isso não aconteceu, a redistribuição para a instância `62 98147-5130` nunca ocorreu. Restaram 210 + 215 pendentes e o job acabou marcado como `erro`.
- A causa foi que a versão da função `send-whatsapp-meta` que retorna `template_paused: true` só passou a valer depois do envio começar (mesmo raciocínio serve para invocações mais antigas em cache do runtime). Precisamos garantir que o worker consiga se recuperar mesmo quando o erro chega como `kind: 'error'` "cru" com a mensagem #132015.

**Plano de correção (Edge Functions):**
1. `supabase/functions/envio-meta-massa-burst/index.ts`
   - No bloco `enviarUm`, se o resultado vier como `kind: 'error'` e `resp?.error` contiver `#132015` ou `is paused`/`paused due to low quality`, reclassificar o resultado como `kind: 'template_paused'` (fallback client-side).
   - Ao entrar na branch `template_paused`, além do item corrente, converter **todos** os outros itens da instância bloqueada que estejam em `status='erro'` com a mesma mensagem de volta para `pendente` (limpando `erro`) antes de redistribuir, para que os 5 itens que hoje estão travados como erro voltem para a fila.
   - Depois da redistribuição, chamar `selfInvoke` para cada instância que recebeu itens (já é feito) **e** também disparar `dispararWorker`-like invocação para cada instância que ainda esteja ativa mesmo que não tenha recebido itens desta rodada (garante que a `62 98147-5130` reative caso já tenha encerrado seu próprio worker).
2. `supabase/functions/envio-meta-massa-control/index.ts`
   - Na ação `reativar`, quando o job tem `instancias_bloqueadas`, pular essas instâncias na hora de reenfileirar itens (ou reatribuir os pendentes delas para instâncias ainda ativas) — evita que "Reativar" mande o worker tentar de novo pela instância que a Meta pausou.
3. Recuperar o job atual (`ac33474f…`): após deploy, uma reativação manual pelo botão "Reativar" deve corrigir os 425 pendentes.

## Problema 2 — Diálogo "Campanhas" piscando sem parar

**Diagnóstico (confirmado em `src/contexts/EnvioMetaSendingContext.tsx`):**
- O canal Realtime em `envio_meta_job_item` (linha 340) escuta **todos** os eventos, sem filtro por job, e chama `carregarItens(jobId)` a cada evento. Em modo rajada saem centenas de updates por minuto, e cada `carregarItens` faz paginação de até 10k linhas e substitui o `Map` inteiro por outro novo.
- O `useEffect` do Realtime (linha 371) inclui `itensByJob` e `carregarItens` nas dependências. Como `carregarItens` chama `setItensByJob(new Map(...))`, cada carregamento troca a referência e o efeito **derruba o canal e re-subscreve**, gerando avalanche de eventos.
- O `CampanhaDetalheDialog.tsx` ainda tem um `setInterval` de 4s que chama `recarregarItensJob`, empilhando com o Realtime.
- Toda essa cascata dispara `setJobs`/`setItensByJob` várias vezes por segundo → re-render do diálogo, e como cada carregamento zera a lista e depois preenche, o usuário vê "piscar".

**Plano de correção (Frontend):**
1. `src/contexts/EnvioMetaSendingContext.tsx`
   - Guardar `itensByJob` e `carregarItens` em `ref`s dentro do `useEffect` do Realtime; remover ambos das dependências para que a subscription não seja recriada.
   - Debounce por `jobId` para `carregarItens` (~2s) e para `carregarJobs` (~1s) usando `setTimeout` acumulativo — coalescendo bursts de eventos numa única chamada.
   - Filtrar o handler de `envio_meta_job_item` para ignorar `job_id` que não esteja em `itensByJob` (via ref), evitando queries inúteis para jobs que o usuário nem abriu.
   - `carregarItens`: fazer merge parcial (atualizar/anexar linhas alteradas quando o payload já traz `id` e `status`) antes de recorrer ao refetch completo, e só paginar até `total` conhecido do job em vez de sempre subir até 10k.
2. `src/components/meta/CampanhaDetalheDialog.tsx`
   - Aumentar o intervalo do polling de 4s para 10s **e** só chamar `recarregarItensJob` quando `backend !== cached` (já feito) — remover o "if running" que força reload contínuo. O Realtime debounced já cobre o restante.

## Detalhes técnicos

- Fallback de detecção do #132015 no worker é o mesmo regex já usado em `send-whatsapp-meta`: `msg.includes('#132015') || /template is (?:temporarily )?unavailable|is paused|paused due to low quality/i.test(msg)`.
- Recuperar itens travados: `UPDATE envio_meta_job_item SET status='pendente', erro=NULL WHERE job_id=$1 AND status='erro' AND erro ILIKE '%132015%'` — executado dentro da branch `template_paused` do worker.
- Debounce simples via `Map<string, number>` de timeouts por `jobId`, limpando no unmount do provider.
- Nenhuma alteração de schema é necessária.

## Fora de escopo

- Não altero regras de qualidade RED/YELLOW nem lógica de rate limit.
- Não mexo na UI visual do diálogo além do intervalo de polling.

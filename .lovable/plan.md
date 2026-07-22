## Objetivo

O botão **Atualizar** do diálogo da campanha deve apenas refrescar contadores e listas — nunca dar a sensação de que "travou o envio" ou fez o botão **Reativar** reaparecer.

## Diagnóstico (não confirmado 100%)

Lendo o código:

- `refreshStatus()` e `recarregarItensJob()` são leituras puras (SELECTs). Elas não conseguem parar o worker `envio-meta-massa-burst`, que roda no servidor e se auto-encadeia enquanto `job.status = 'rodando'`.
- O worker se auto-termina quando: (a) atinge `restantes = 0` num snapshot (mesmo que existam itens em `processando`), (b) recebe erro permanente, ou (c) alguma trava marca `status = 'erro'`.
- Quando isso acontece, `Atualizar` só está *revelando* um estado que já mudou no servidor — mas para o usuário parece que foi o clique que parou.

Como o diagnóstico "quem realmente parou o worker" não está 100% confirmado, o plano ataca os dois lados: garantir que **Atualizar seja inócuo** e que **o envio se auto-retome** se detectar que parou com pendências.

## Mudanças

### 1. `src/components/meta/CampanhaDetalheDialog.tsx` — Atualizar silencioso
- Novo handler `atualizarSemInterferir()` no botão Atualizar.
- Ele chama apenas `recarregarItensJob(job.id)` (que refaz `carregarItens` + `carregarLogs`) e um novo `refreshCountersJob(job.id)` (ver item 2).
- **Não** chama mais `refreshStatus()` (que recarrega todos os jobs e substitui a linha inteira do job, podendo trocar `status` de `rodando` → `erro`/`concluido` na UI).

### 2. `src/contexts/EnvioMetaSendingContext.tsx` — refresh parcial
- Adicionar `refreshCountersJob(jobId)`:
  - Lê da `envio_meta_job` só: `enviados, erros, total, atual_telefone, atual_instancia, proximo_em`, e conta `pendente+processando` para derivar `restantes`.
  - Atualiza o job em `jobs[]` fazendo *merge* — preserva `status` e `status_motivo` já em memória.
- Assim, clicar Atualizar nunca faz o botão Reativar aparecer sozinho; o botão só aparece quando o Realtime traz uma mudança real de `status`.

### 3. `src/contexts/EnvioMetaSendingContext.tsx` — auto-retomada
- Watcher em `useEffect([jobs])`: para cada job com `status ∈ {erro, cancelado, concluido}` **mas** `restantes > 0` e que **não foi cancelado manualmente pelo usuário** (novo `Set` `manuallyCanceledRef`), disparar `reativarJob(jobId)` uma vez (guardar em `Set` `autoResumedRef` para não ficar em loop caso a Meta rejeite de novo imediatamente — usar cooldown de 60s por job).
- Em `cancelarJob`, marcar `manuallyCanceledRef.add(jobId)` para nunca auto-retomar cancelamento voluntário.
- Em `reativarJob` (manual), limpar `manuallyCanceledRef` e `autoResumedRef` para permitir novo ciclo.

### 4. Robustez do worker (bônus, mesmo arquivo `supabase/functions/envio-meta-massa-burst/index.ts`)
- Antes de considerar `restantes = 0` e chamar `tentarEncerrarJob`, contar também itens em `processando` da **mesma instância** — se houver, agendar `selfInvoke` curto (2s) em vez de tentar encerrar. Isso evita que uma janela de corrida (itens reservados mas ainda não gravados como enviados) encerre o job antes da hora.

## Como o usuário perceberá

- Clicar **Atualizar** apenas atualiza os cards de "Aceito/Entregue/Lida/Falhou/Aguardando", listas de Enviados/Erros e o contador de processados. O status atual (Enviando/Erro) não muda por causa do clique.
- Se o worker parar sozinho por rate limit / erro transiente e ainda houver pendentes, o sistema retoma sozinho em segundos, sem exigir clique manual em Reativar.
- Se **você** clicar em Cancelar, o sistema respeita e não auto-retoma.

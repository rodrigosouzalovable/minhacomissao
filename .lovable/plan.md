## Problema

Ao clicar em "Iniciar envio" com delay 5–10s, a UI mostra "Próximo envio em ~38–60s" e o primeiro disparo demora. A causa é dupla:

1. O `iniciar` grava `proximo_em = agora` e faz um `self-invoke` fire-and-forget do `tick`. Como o boot da edge function não é instantâneo (frio + auth + query), a UI já monta o card com o `proximo_em` atrasando poucos segundos, e qualquer bloqueio interno (ex.: `pick-meta-instance` sem instância elegível no primeiro segundo, `send-whatsapp-meta` retornando `tier_full`/`pool_blocked`) empurra `proximo_em` para **+30s ou +60s fixos**, ignorando o delay 5–10s do usuário.
2. Os blocos "moles" (`sem_disponivel`, `tier_full`, `pool_blocked`) no `tick` estão hardcoded em `60_000` / `30_000` ms. Isso é o que aparece no contador.

Blocos "duros" reais (domingo, fora do horário permitido) continuam com 10min — isso é intencional e não muda.

## Objetivo

- Ao clicar Iniciar, começar a enviar **imediatamente**, sem 60s de espera visual.
- Retries por indisponibilidade momentânea devem respeitar o `min_seg`/`max_seg` configurado (5–10s no exemplo), não 30/60s fixos.

## Mudanças

### 1. `supabase/functions/envio-meta-massa-iniciar/index.ts`
- Após inserir job + itens, **executar o primeiro item de forma síncrona** antes de responder ao cliente, chamando internamente a mesma lógica do `tick` para 1 item. Assim, quando a UI recebe a resposta e monta o card, o `enviados` já é `1` (ou o item ficou `erro` com motivo real) e o `proximo_em` já reflete um delay 5–10s real.
- Depois disparar o self-invoke para continuar o loop.

Alternativa mais simples (preferida): apenas aguardar a primeira chamada de `tick` (com `await fetch(...tick, { job_id })`) por até ~8s antes de retornar. Assim o front só recebe `success` depois que 1 item já tentou enviar.

### 2. `supabase/functions/envio-meta-massa-tick/index.ts`
Substituir os `waitMs` fixos por um helper `delayUsuario(job)` que sorteia entre `job.min_seg` e `job.max_seg` (segundos) quando o motivo for **soft**:

- `pick` → `sem_disponivel`: usar `delayUsuario` (antes: 60s).
- `pick` → outros erros genéricos: usar `delayUsuario` (antes: 30s).
- `send` → `tier_full` / `pool_blocked` / `pool_paused`: usar `delayUsuario` (antes: 30s). O item volta a `pendente` como já faz.
- `send` → `blocked=domingo|horario`: **manter 10min** (bloqueio duro real).
- `pick` → `blocked=domingo|horario`: **manter 10min**.

Isso garante que o "Próximo envio em Xs" mostre sempre 5–10s (ou o intervalo configurado), exceto nos dois bloqueios duros legítimos.

### 3. UI — `src/pages/EnvioMeta.tsx` (opcional, cosmético)
Quando `job.status_motivo` estiver preenchido (ex.: `sem_disponivel`, `tier_full`), mostrar uma linha discreta ao lado de "Próximo envio em Xs" com o motivo, para o usuário entender que o retry curto é intencional. Nenhuma mudança de layout maior.

## O que não muda

- Domingo e fora do horário permitido continuam com espera de 10 minutos (comportamento correto de segurança).
- Cron de 10s como safety-net permanece.
- Frontend do `EnvioMetaSendingContext` não muda (já lê `proximo_em` corretamente).
- Nada em `pick-meta-instance` / `send-whatsapp-meta`.

## Resultado esperado

- Clicar em Iniciar → em ≤8s o primeiro envio acontece (ou falha com motivo real) → contador passa a mostrar 5–10s entre disparos, respeitando o delay configurado.
- Retries por instância momentaneamente indisponível também respeitam 5–10s em vez de 30–60s.
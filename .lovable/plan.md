## Diagnóstico da campanha atual

Job `solicitacao_de_renegociacao` (669 contatos, iniciado 14:05):
- **1 instância selecionada** (MEMU 25), slider em **10 msg/s**.
- 96 min depois: **320 enviados, 7 erros, 342 pendentes** → cadência real ≈ **0,056 msg/s** (bem abaixo dos 10/s configurados).
- Os 7 rate-limits (#131056 "Retry after ~10.5s") aconteceram em janela de 6 s (17:07:26–17:07:32), logo no início.
- `rajada_taxa_atual` na instância = **6** desde 17:07 (não colapsou até 1, mas travou).

Causa raiz combinada:
1. O worker começa a **janela em 1 msg/s** e só sobe +1 a cada **3 janelas consecutivas sem erro** — leva 24 s+ para chegar em 10/s mesmo em cenário limpo.
2. Ao ver rate-limit, a janela é cortada **pela metade** e a instância marca `rate_limit_ate`. Enquanto `rate_limit_ate` estiver no futuro, cada re-invocação do worker sai imediatamente e re-agenda em 2 s — gastando invocações sem enviar.
3. `selfInvoke` aplica `Math.min(delayMs, 2000)` mesmo quando o Meta pede 10 s de espera → sequência de re-invocações vazias.
4. Só há 1 instância no job, então mesmo na taxa alvo o teto físico é ~10 msg/s (não é o problema principal, mas contribui).

## O que o plano muda em `supabase/functions/envio-meta-massa-burst/index.ts`

**1. Começar já no teto do slider, não em 1**
- Ao entrar no worker, se `rajada_taxa_atual` estiver estale (sem ajuste nas últimas 15 min) e sem `rate_limit_ate` ativo, **resetar `rajada_taxa_atual = mpsAlvo`** antes de entrar no loop.
- Isso evita "penalidade eterna" após um pico isolado de rate-limit no começo (que é exatamente o caso atual: taxa=6 travada há 96 min).

**2. AIMD menos punitivo**
- Corte no rate-limit: `janela = max(3, ceil(janela * 0.7))` (antes: `floor(janela/2)` com piso 1).
- Ramp-up: **1 janela OK** já sobe +1 (antes: 3 janelas).
- Piso mínimo da janela: **3 msg/s** por instância (Meta permite muito mais, e o rate-limit real vem por WABA, não por instância).

**3. Backoff correto após rate-limit**
- Em `selfInvoke`, respeitar `delayMs` até **10 s** (não 2 s). Como o Meta manda `retry_after` de ~10 s, deixamos o worker realmente esperar 1 vez, sem re-invocar em loop.
- Manter o teto absoluto (`min(esperaRateLimitMs, 30_000)`) já existente.

**4. Destravar `rate_limit_ate` órfão**
- Se `rate_limit_ate` estiver no passado (mais de 5 min) e `pausa_automatica_ate` também no passado, o próprio worker limpa esses campos antes de iniciar (idempotente). Evita ficar "vendo" um rate-limit antigo.

**5. Reset one-shot da instância travada (script embutido no worker)**
- Na primeira invocação após deploy, para qualquer instância cujo `rajada_ultimo_ajuste_em > 15 min atrás` **e** `rajada_taxa_atual < mpsAlvo`, o worker faz o reset descrito no item 1. Isso desbloqueia MEMU 25 sem precisar de UI manual.

## O que muda em `src/pages/EnvioMeta.tsx`

**6. Aviso quando o usuário selecionar 1 instância em Rajada**
- Se `instancia_ids.length === 1` e `total > 500`, mostrar um `Alert` amarelo:
  _"Você selecionou 1 número para X mensagens. Mesmo no modo Rajada, a Meta limita ~10 msg/s por número — o envio de X mensagens levará ~Y min. Adicione mais instâncias para acelerar."_
- Puramente informativo; não bloqueia.

## O que **não** muda

- Nada em `send-whatsapp-meta` (a lógica de rate-limit ali segue igual).
- Estrutura de tabelas, RLS, template, formato de mensagens.
- Modos não-rajada.

## Efeito esperado

Na campanha atual (após deploy + retry pelo botão "Tentar novamente" que já existe):
- Taxa por instância volta a **10 msg/s** imediatamente.
- Os 342 pendentes acabam em ~35 s no melhor caso, ~2–3 min com 1–2 rate-limits pelo caminho.
- Nas próximas campanhas, mesmo com rate-limits eventuais, a cadência média fica próxima do teto do slider em vez de colapsar para <0,1/s.

## Detalhes técnicos

Arquivos tocados:
- `supabase/functions/envio-meta-massa-burst/index.ts` — todos os itens 1–5.
- `src/pages/EnvioMeta.tsx` — item 6 (Alert).

Nenhuma migração de banco. Colunas `rajada_taxa_atual`, `rajada_ultimo_ajuste_em`, `rate_limit_ate`, `pausa_automatica_ate`, `pausa_automatica_motivo` já existem em `meta_whatsapp_instances`.

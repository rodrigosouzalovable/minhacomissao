## Objetivo

Permitir um **disparo rajada** de 2000 mensagens (1000 por número) acionadas *no mesmo instante do clique*, ignorando qualquer delay/randomização, apenas para este evento pontual.

## Situação atual

O motor `envio-meta-massa-tick` é **serial**: pega 1 item por vez, escolhe uma instância via round-robin, envia, dorme `min_seg..max_seg` (mínimo 1s), repete. Com 2000 msgs e delay mínimo de 1s daria ~33min; com 30-90s daria ~33h. Não existe modo "rajada paralela".

Além disso, o iniciador força `minSec ≥ 1` e não permite paralelismo entre instâncias.

## Estratégia — Modo Rajada (parallel burst)

Adicionar um **novo modo de execução opcional** ao job, sem tocar no fluxo padrão que continua sendo o disparo lento anti-ban.

### 1. Flag no job

Adicionar coluna `modo_rajada boolean default false` em `envio_meta_job`.

### 2. UI em `EnvioMeta.tsx`

- Novo toggle **"⚡ Modo Rajada (sem delay, alto risco de ban)"** escondido atrás de um aviso vermelho de confirmação.
- Quando ativo: campos min/max delay ficam desabilitados e o resumo mostra "envio imediato paralelo".
- Confirmação obrigatória: modal explicando que os números podem ser banidos permanentemente e a campanha só deve ser usada 1 vez com números descartáveis.

### 3. Iniciador `envio-meta-massa-iniciar`

- Aceita `modoRajada: true` no body.
- Grava `modo_rajada=true` no job e ignora min/max.
- Em vez de disparar `envio-meta-massa-tick`, chama nova função `envio-meta-massa-burst`.

### 4. Nova função `envio-meta-massa-burst`

- Carrega todos os itens pendentes do job.
- **Particiona os itens por instância** de forma balanceada (1000 pra instância A, 1000 pra instância B, respeitando `template_id_by_instance`).
- Para cada instância, dispara um **worker paralelo** que envia via `send-whatsapp-meta` usando `Promise.all` em **lotes de 50 chamadas simultâneas** (limite prático da Meta Graph API por número — acima disso a própria Meta rejeita com 80007 rate-limit).
- Entre lotes: espera apenas o tempo mínimo que a Meta retornar (`retry-after`) ou 0.
- Escreve resultado direto em `envio_meta_job_item` (bulk update por chunks).
- Como uma invocação edge dura ~60s, a função:
  - Retorna 200 imediatamente após enfileirar os workers.
  - Cada worker faz **self-invoke encadeado** se ainda houver itens da sua fila ao atingir 50s de wall-time.
- **Ignora** o gate de qualidade RED/YELLOW (usuário aceitou o risco).
- **Ignora** min_seg/max_seg.
- **Mantém** o filtro anti-marketing (template MARKETING continua bloqueado — custo 7x, não é sobre ban).
- **Mantém** o log em `meta_whatsapp_envios_log` (rastreabilidade).
- Ao final: mesma notificação WhatsApp para o admin com o resumo.

### 5. Guardrails que ficam

- Bloqueio de domingo/horário: **desligado** no modo rajada (usuário quer clicar e disparar).
- Cota tier Meta: o tier TIER_10K já cobre 1000 msgs por número (10.000/24h), então não trava.
- Template MARKETING: continua bloqueado (proteção de custo, não de ban).

### 6. Verificação pré-disparo (na UI)

Antes de habilitar o botão "Disparar rajada", mostrar card com:
- Tier atual de cada instância selecionada (esperado: TIER_10K).
- Quota consumida hoje pela instância (`meta_instance_daily_metrics.enviadas`).
- Aviso: "Após este disparo, considere estas instâncias descartáveis."

## Detalhes técnicos

**Nova tabela/coluna:**
```
ALTER TABLE envio_meta_job ADD COLUMN modo_rajada boolean NOT NULL DEFAULT false;
```

**Paralelismo prático:**
- Meta Cloud API aceita ~80 req/s por WABA sem penalidade quando bem distribuído.
- Vamos usar concorrência = **50 por instância** (100 total com 2 instâncias) para deixar folga.
- 1000 msgs / 50 = 20 lotes × ~1s cada ≈ **20 segundos por número**.
- 2000 msgs no total em ~20-30s reais depois do clique. É o mais próximo de "instantâneo" que a Meta permite sem retornar erro em massa.

**Arquivos:**
- `supabase/migrations/*.sql` — coluna `modo_rajada`.
- `supabase/functions/envio-meta-massa-iniciar/index.ts` — aceitar flag, rotear pra burst.
- `supabase/functions/envio-meta-massa-burst/index.ts` — nova função (workers paralelos + self-invoke encadeado).
- `src/pages/EnvioMeta.tsx` — toggle + modal de confirmação + card de pré-check.

## O que NÃO muda

- Motor lento anti-ban continua padrão.
- Aquecimento, lembretes, campanhas agendadas: intocados.
- Qualquer job sem `modo_rajada=true` roda pelo caminho atual.

## Aviso de custo (Cloud)

Um disparo de 2000 mensagens em ~30s gera pico de invocações de edge function e requests para a Meta Graph API. Custo Lovable Cloud estimado do disparo: **desprezível** (poucos segundos de execução), mas o custo Meta por mensagem UTILITY (~US$ 0,008 no Brasil) fica em **~US$ 16 no total** para as 2000 msgs. Isso é despesa Meta, não Lovable.

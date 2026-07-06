## Problema

O envio está travado em 20/dia por instância porque:

- `get_effective_daily_quota` retorna `min(fase_quota, tier_quota)`, e em `fase1` (instância com <=3 dias de idade) `fase_quota = 20`.
- Todas as instâncias hoje já bateram 20 envios, então `pick-meta-instance` responde `sem_disponivel` e o job encerra sem enviar.
- Existe também um segundo bloqueio dentro de `send-whatsapp-meta` usando `cotasFase[inst.fase_rampup]`.

Você quer controlar o volume manualmente pelo delay/planilha, sem que o sistema aplique cota diária automática.

## Mudança

Remover completamente a cota de ramp-up do fluxo de envio em massa Meta, mantendo apenas os bloqueios de segurança reais.

### 1. `pick-meta-instance`

- Remover `if (fase === 'aguardando') continue`.
- Remover cálculo de `cotaFase` e o `if (uso >= cota) continue`.
- Manter:
  - `estado_pool = 'ativo'`
  - `pausa_automatica_ate`
  - qualidade `RED/YELLOW` bloqueia (`pesoQualidade = 0`)
  - bloqueio de domingo e horário 08–20h BRT

### 2. `send-whatsapp-meta`

- Remover o bloco `cotaFase` / `tier_full` por fase (linhas ~304–324).
- Manter:
  - `estado_pool` diferente de ativo → `pool_blocked`
  - `pausa_automatica_ate` no futuro → `pool_paused`
  - domingo / fora do horário → `blocked`
  - contador `enviados_hoje` continua sendo incrementado só para telemetria

### 3. `envio-meta-massa-iniciar` + `envio-meta-massa-tick`

Sem alteração de regra — já foram ajustados para:

- disparar o primeiro envio na hora ao clicar em `Disparar`
- respeitar o delay 5–10s entre envios
- encerrar com motivo real caso todas as instâncias estejam pausadas/qualidade ruim/fora do horário

Como as cotas caem, o `sem_disponivel` só vai aparecer nos casos legítimos (pausa/qualidade/horário).

## O que continua bloqueando (intencional)

- Domingo
- Fora do horário 08–20h BRT
- Instância com qualidade RED/YELLOW
- Instância em pausa automática (após incidente)
- Instância inativa no pool

Esses continuam porque são proteções anti-ban da API Oficial Meta, não limites de volume.

## Aviso importante sobre custo e risco

Remover a cota de ramp-up significa:

- O sistema não vai mais frear você em 20/50/150/400 mensagens por número por dia.
- Você poderá enviar até o limite real que a Meta impõe por chip (250, 1K, 10K, 100K, Unlimited).
- Custo de envio Meta escala junto — cada template disparado é cobrado pela Meta.
- Chips novos (<7 dias) ficam mais expostos a `Quality Rating` cair para YELLOW/RED se receberem volume alto sem opt-in.

Recomendo manter a checagem de saúde diária ligada para reagir rápido caso alguma instância caia de qualidade.

## Validação depois da implementação

1. Rodar um novo disparo com o mesmo template e mesmos números para confirmar que `pick-meta-instance` retorna `success` mesmo com `enviados_hoje = 20`.
2. Verificar que a primeira mensagem sai em menos de 10s após o clique em `Disparar`.
3. Confirmar que o contador `Próximo envio em Xs` mostra entre 5s e 10s.
4. Confirmar no log de `meta_whatsapp_envios_log` que as mensagens estão sendo enviadas.
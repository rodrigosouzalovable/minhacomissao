
## Objetivo

Distribuir envios via API oficial Meta em **todos os números conectados** (hoje 20, crescendo continuamente), com ramp-up individual, auto-pausa em queda de qualidade e bloqueio de domingo — para evitar o que aconteceu com iPhone B7/B8.

## Decisões confirmadas

- **Ramp-up dia 1 para todos**: só 1 número tem templates aprovados, os outros ainda estão aguardando aprovação Meta. Assim que cada um for aprovado, entra no pool começando do dia 1.
- **Domingo**: totalmente bloqueado (segue regra global já existente).
- **Auto-pausa em YELLOW** (mais conservador que RED): assim que qualidade cair para YELLOW, pausa o número + notifica admin. Se cair para RED, pausa toda a WABA.
- **Escalabilidade**: novos números entram automaticamente no pool assim que forem marcados como aprovados/ativos.

## Como o pool vai funcionar (5 pilares)

### 1) Distribuição por score de saúde (substitui round-robin cego)

Para cada envio, o sistema calcula em tempo real o score de cada número ativo:

```
score = quality_peso × tier_peso × idade_fator × (1 − uso_hoje/cota_dia)
```

- `quality_peso`: GREEN=100, UNKNOWN=60, YELLOW=0 (pausado), RED=0 (pausado)
- `tier_peso`: TIER_250=1, TIER_1K=4, TIER_10K=40, TIER_100K=400, UNLIMITED=1000
- `idade_fator`: <7d=0.3 · 7–30d=0.7 · >30d=1.0
- Enviado hoje ÷ cota do dia (barrar quando atinge 100%)

Ganha o envio quem tem maior score naquele instante. Números novos recebem carga baixa, números maduros GREEN carregam o volume.

### 2) Ramp-up automático de 21 dias por número

| Dias na API | Cota diária | Regra |
|---|---|---|
| 1–3 | 20 msg | Só respostas em janela 24h + até 5 templates |
| 4–7 | 50 msg | Templates UTILITY apenas |
| 8–14 | 150 msg | UTILITY |
| 15–21 | 400 msg | UTILITY |
| 22+ | Cota do `messaging_limit_tier` | Livre |

Nova coluna `data_ativacao_api` em `meta_whatsapp_instances`. Assim que um número tem template aprovado + é marcado ativo, começa a contagem do dia 1.

### 3) Delays e horário

- Entre envios do **mesmo número**: 45–120s aleatório.
- Entre envios de **números diferentes**: 3–8s.
- Horário: 08:00–20:00 BRT, seg–sáb.
- **Domingo bloqueado** (fila pausa e retoma segunda 08:00).
- Após 50 envios seguidos no mesmo número: pausa forçada de 30 min.

### 4) Monitor de saúde ativo com auto-pausa em YELLOW

Estender `check-meta-instance-health` para rodar **a cada 2h**:

- **UNKNOWN → GREEN**: apenas registra evolução.
- **Qualquer → YELLOW**: **pausa o número imediatamente** (`ativo=false`, `pausa_automatica_ate` = +48h), notifica admin no 62991672674 explicando qual número e por quê.
- **Qualquer → RED**: pausa **todos os números da mesma WABA** + notificação urgente.
- **Status FLAGGED/RESTRICTED/BANNED**: pausa permanente e notifica.

Retomada manual (o admin decide reabrir pelo painel).

### 5) Guardrail de conteúdo (já parcialmente feito)

O `MetaGuardrailCard` já bloqueia MARKETING. Adicionar:

- Antes de cada lote de massa, roda `meta-sync-templates` para revalidar categoria.
- Se template mudou UTILITY→MARKETING, aborta lote e notifica.
- `meta_whatsapp_envios_log` grava a categoria do template no momento do envio (auditoria).

## Painel visual (aba nova em MonitorEnvios)

Cards por número mostrando:
- Foto, nome, telefone
- Bolinha de qualidade (verde/amarelo/vermelho/cinza)
- Tier atual + idade na API + fase do ramp-up
- Barra "Enviadas hoje / cota do dia"
- Score de saúde calculado
- Botão pausar/retomar manual
- Alertas visuais em pausa automática

Também um resumo topo: "N números ativos · X mensagens enviadas hoje · Y disponível ainda hoje".

## Onboarding de novos números (importante para escalar)

Quando você conectar um número novo:

1. Aparece automaticamente em `meta_whatsapp_instances` (fluxo existente).
2. Fica em estado `aguardando_templates` (não entra no pool ainda).
3. Assim que os templates forem aprovados e você marcar `ativo=true`, sistema seta `data_ativacao_api = hoje` e ele entra no dia 1 do ramp-up.
4. Botão "Ativar no pool" no painel para você confirmar quando quiser incluir.

## Impacto esperado

- Redução do risco de ban ~80% respeitando ramp-up (padrão observado por integradores Meta).
- Volume total escala com o pool: 20 números maduros em TIER_10K = até 200k msg/dia sem risco (vs. 20k concentrando em 2 números, que foi o que derrubou B7/B8).
- Qualidade tende a subir para GREEN em 2–3 semanas quando só rodam UTILITY com respostas reais.

## Arquivos e mudanças técnicas

**Migration** (`supabase/migrations/...`):
- `meta_whatsapp_instances`: adicionar `data_ativacao_api date`, `fase_rampup text`, `pausa_automatica_ate timestamptz`, `score_saude_cache numeric`, `estado_pool text` (aguardando_templates/ativo/pausado).
- Nova tabela `meta_envio_pool_config` (singleton): parâmetros configuráveis (delays min/max, cotas por fase, threshold auto-pausa).
- Índice em `meta_whatsapp_envios_log(instancia_id, enviado_em::date)` para contagem rápida de cota.

**Edge functions**:
- `send-whatsapp-meta-massa/index.ts` (nova ou reescrita): pega próxima mensagem da fila `meta_envios_fila`, calcula score de todos os números ativos, escolhe o vencedor, aplica delay, envia.
- `check-meta-instance-health/index.ts`: estender com auto-pausa YELLOW/RED + notificação.
- Novo `meta-rampup-scheduler`: cron 4x/dia atualiza `fase_rampup` conforme idade.
- `meta-billing-relatorio-diario` (do plano anterior, ainda válido): 19h BRT.

**Frontend**:
- `MonitorEnvios.tsx`: nova aba "Meta Oficial" com cards por número + resumo.
- `ConfigurarMeta.tsx`: card do pool (editar delays, cotas por fase, thresholds).
- `EnvioMeta.tsx`: mostrar preview "vai usar N números disponíveis, tempo estimado X, cota total Y".
- Componente `NumeroPoolCard` reutilizável.

## Fora do escopo

- Não altera aquecimento UAZAPI.
- Não altera guardrail MARKETING (já existe).
- Sistema de conectar Meta Business com System User Token (assunto do outro plano, permanece pendente aguardando o vídeo/App Review).

## Ordem de execução

1. Migration com colunas + tabela de config + backfill (`data_ativacao_api = hoje` só para o número já aprovado; os outros ficam `aguardando_templates`).
2. Edge function de send-massa com algoritmo de score + delays + bloqueio domingo.
3. Estender health-check com auto-pausa YELLOW.
4. Cron de ramp-up.
5. UI (aba MonitorEnvios + card de config + botão "ativar no pool").
6. Teste com o único número aprovado hoje (lote pequeno de 20 msg no dia 1).
7. Conforme Meta for aprovando os outros templates, você clica "ativar no pool" e cada número inicia seu próprio dia 1.

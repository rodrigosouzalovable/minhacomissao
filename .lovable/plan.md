# Liberar teto de envio (sem limite) e destravar a campanha do Thiago

## O que está acontecendo hoje (verificado agora)

- A campanha **Odres 15 dias** (Thiago) está `rodando` com motivo `AGUARDANDO_COTA` — 50/190 enviados — porque o número **AMARAL 62 8273-8416** está com **teto 15/dia** e já enviou **189**.
- Esse número está **GREEN, sem quarentena, sem recuperação, cota Meta de 2.000/dia**. O 15 vem da nossa rampa interna (fase 1 = `cota_fase1 = 15`), não da Meta.
- O teto de 250 liberado manualmente hoje foi **sobrescrito**: o job de freio de qualidade roda a cada 30 min e regrava `teto_efetivo` a partir da rampa, voltando para 15. Por isso a campanha parou de novo.

## O que vou fazer

### 1. Modo "sem teto" para os números saudáveis
Nova chave de configuração no Pool Meta (`sem_teto_global`), ligada:

- Números **GREEN** passam a não ter teto diário nem teto por hora — só respeitam o delay configurado, a janela 08h–19h BRT e o bloqueio de domingo.
- O limite real passa a ser a **cota da própria Meta** (tier do número), não mais a rampa interna.

### 2. Proteção mantida (e reforçada) para YELLOW / RED
Mesmo com o teto livre, continuam bloqueados de campanha, sem exceção:

- número em **quarentena**;
- número em **recuperação automática de qualidade** (o processo que aquece com os UAZAPI até voltar a GREEN);
- número **RED**;
- número **YELLOW** segue com teto reduzido (rampa/escada normal), nunca livre.

Ou seja: livre para quem está GREEN, cuidado redobrado para quem caiu de qualidade.

### 3. Fim da sobrescrita do teto liberado
O job de freio deixa de apagar liberações: quando o teto do dia foi liberado manualmente ou o modo sem teto está ligado, ele só atualiza contadores e métricas (para o painel), sem baixar o teto de números GREEN.

### 4. Destravar a campanha do Thiago agora
- Liberar o teto de hoje do AMARAL 62 8273-8416 e retomar os **140 pendentes** imediatamente, sem esperar reavaliação.
- Confirmar em seguida que voltou a enviar (contador subindo, sem erro).

### 5. Painel
No Pool Meta e no detalhe da campanha, indicar claramente quando o modo sem teto está ligado, e continuar mostrando quais números estão em recuperação/quarentena (que não participam).

## Detalhes técnicos

- Migração: `meta_envio_pool_config.sem_teto_global boolean default false`; `meta_instance_freio_diario.liberado_manual boolean default false`.
- `pick-meta-instance`: com `sem_teto_global = true` e instância GREEN, pular as checagens de `teto_efetivo` e `cota_max_hora`; manter intactos os gates de `estado_pool`, `pausa_automatica_ate`, `quarentena_ate`, `recuperacao_ativa`, qualidade RED e o teto reduzido de YELLOW.
- `meta-qualidade-freio`: não regravar `teto_efetivo` quando `liberado_manual = true` ou (`sem_teto_global` e GREEN) — segue gravando `enviados`, `resposta_pct`, `nao_lidas_pct` e motivo informativo. Para YELLOW/RED o comportamento atual de corte permanece.
- `envio-meta-massa-control` / `liberar_teto_hoje`: gravar `liberado_manual = true` e permitir teto até a cota real da Meta quando `sem_teto_global` estiver ligado (segue bloqueado para RED/recuperação).
- `PoolMetaPanel.tsx`: switch "Sem teto (usar cota da Meta)" separado do Modo Turbo, com aviso de risco; `CampanhaDetalheDialog.tsx`: texto de espera por cota refletindo o novo modo.
- Ação de dados: `meta_instance_freio_diario` do dia para `89eaf081…` com teto na cota da Meta + `liberado_manual = true`, job `06da3b5d…` com `status_motivo = null` e `proximo_em = now()`, e disparo do tick.

## Aviso de custo

⚠️ Sem teto diário, o volume de mensagens Meta pode subir bastante — o custo maior aqui é o das mensagens na Meta, não o do Lovable Cloud. O risco de queda de qualidade também aumenta; as travas de quarentena/recuperação continuam ligadas para conter isso.

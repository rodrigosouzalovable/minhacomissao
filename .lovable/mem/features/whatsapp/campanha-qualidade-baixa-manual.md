---
name: Campanha manual mantém YELLOW/RED e ritmo real do delay
description: Campanha iniciada manualmente com números não-GREEN grava permitir_qualidade_baixa e mantém YELLOW/RED até o fim; checagens de saúde nunca bloqueiam o envio
type: feature
---

- `envio_meta_job.permitir_qualidade_baixa` é gravado como `true` por
  `envio-meta-massa-iniciar` quando a campanha é iniciada **manualmente** (sem
  agendamento) e alguma instância selecionada não está GREEN. Nesses jobs,
  YELLOW/RED **não** saem do rodízio (`removerInstanciasComQuedaQualidade` só
  avisa, uma vez por job+instância, tipo `envio_meta_qualidade_mantida`) e a
  reabilitação também aceita não-GREEN. Campanhas agendadas seguem a regra
  antiga (queda para YELLOW/RED tira o número).
- Bloqueios reais da Meta continuam valendo: banido, restrito, conta bloqueada
  (#131031), pendência de pagamento, nome REJECTED e cota real do número.
- "Selecionar todas (GREEN)" no Envio Meta continua marcando só instâncias sem
  problema; YELLOW/RED/sem leitura só entram marcadas manualmente.
- Performance do ritmo: `check-meta-instance-health` nunca é aguardado dentro do
  envio (fire-and-forget em paralelo), o intervalo de 5 min é persistido em
  `envio_meta_job.saude_checada_em` / `reabilitacao_checada_em` (não em memória),
  e `pick-meta-instance` conta envios do dia/hora de todas as candidatas em uma
  única consulta (`enviadosHojeBrtLote`). Antes disso o envio parava 2–4 min a
  cada 5 min.

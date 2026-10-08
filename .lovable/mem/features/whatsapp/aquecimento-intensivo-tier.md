---
name: Aquecimento intensivo de tier + regras de template
description: Modo intensivo (~450 únicos/dia, 1.300 em 3 dias) com lead_followup_sem_resposta, primeiro nome da empresa, só UTILITY e variável numerada
type: feature
---

- Trilha `meta_aquecimento_trilha.modo_intensivo = true` para instância com tier < 10.000: alvo ~450 destinatários únicos/dia (teto duro 60% do tier), mix 25% UAZAPI / 75% leads Google Maps.
- `meta-aquecimento-tick`: até 80 envios/execução, 15 por instância, 2–6s entre mensagens do lote, 60–180s entre rodadas; cria a trilha na hora quando a instância elegível ainda não tem plano do dia.
- Correção de rota: se ≥10 leads nos últimos 30 min e taxa de resposta < 15%, mix UAZAPI sobe para ≥70%; score de nicho recalculado a cada 3h (resposta, resposta ≤120s, reclamações). Nicho com ≥12 envios e zero resposta sai da fila.
- Variável do template no aquecimento usa só o primeiro nome da empresa ("NeoPets Veterinária e Petshop" → "NeoPets"; prefixo genérico como "Clínica" leva duas palavras).
- Templates: somente UTILITY e variável numerada `{{1}}`. Variável com nome é bloqueada na criação/injeção. Se uma cópia for reclassificada para MARKETING, preservar a categoria real e o aviso, sem parar a distribuição nas demais instâncias nem desmarcar a cópia automática. Isso não autoriza disparos Marketing nem habilita uso em leads. Preservar cópias aprovadas/pendentes, proprietários, bloqueios reais e cotas.
- Erro Meta `#131031` (Business Account locked) pausa todas as instâncias da BM por 12h (`pausa_automatica_motivo`) e devolve o lead à fila.
- Tela Templates Meta mostra a BM ao lado de cada instância, com link para o Gerenciador de Negócios.

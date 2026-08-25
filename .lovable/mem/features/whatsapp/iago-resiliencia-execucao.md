---
name: IAGO — resiliência da execução
description: Trava sempre liberada em falha, retry da IA, espaçamento de rajadas por telefone e silêncio em divulgação em massa
type: feature
---

- Toda execução de `iago-atendimento` que falhar depois de `iago_claim_message` grava a falha em `iago_falhas` (admin-only), libera a trava (`iago_finish_message`) e aplica a etiqueta "Aguardando Humano". Conversa nunca fica travada e silenciosa.
- `chamarIA` (`_shared/iago.ts`) faz 1 nova tentativa: em `rate_limit` espera 4–8s e repete com modelo de reserva (`google/gemini-2.5-flash`). `sem_creditos` não é repetido.
- Rajada: antes da trava, conta estados do mesmo telefone atualizados nos últimos 90s e espera até 20s proporcionalmente, para o mesmo número escrevendo a vários chips não estourar o limite de IA.
- Divulgação em massa/robô (`ehDivulgacao` + mesmo texto recebido em ≥3 instâncias na última hora): não responde nada, etapa `divulgacao_em_massa`, etiqueta "Aguardando Humano" e entrada concluída.

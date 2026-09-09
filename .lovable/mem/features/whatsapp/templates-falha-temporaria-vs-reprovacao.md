---
name: Templates — falha temporária da Meta ≠ reprovação
description: Erro temporário da Meta (code 2 / HTTP 500 / retry later) reenfileira o template e nunca pausa a fila do número; avisos mostram a BM vinculada
type: feature
---
- `_shared/humanizar-erro-template.ts` expõe `ehErroTemporario()` + `humanizarErroTemplate()` (espelho de `src/lib/humanizarErroTemplate.ts`).
- Em `meta-templates-onboarding-tick`: erro temporário (HTTP 429/500/502/503/504, `code 2`, `code 4`, timeout, rate limit) → item volta a `PENDENTE` com backoff, até `MAX_TENTATIVAS = 3`, **sem** somar em `templates_auto_rejeicoes_seguidas` e sem `PAUSADO_REJEICOES`. Aviso usa "⏳ Falha temporária da Meta".
- Só `REJECTED` real e erros de cadastro (cabeçalho vazio, variável sem exemplo, nome duplicado, token/permissão) contam para a pausa.
- Todos os avisos de template (falha temporária, reprovação, pausa 24h, conclusão) incluem a linha `BM: *<nome>*` via `linhaBmInstancia`.

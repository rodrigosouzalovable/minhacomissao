## Problema

Hoje é domingo (07/06/2026). A edge function `notificar-boletos-pendentes` tem um bloqueio rígido nos domingos e retorna `{ ok: true, skipped: "domingo" }` sem processar nada. O frontend lê apenas `data.total`, que vem `undefined`, e mostra "Execução D-1: 0 parcelas processadas" — escondendo o motivo real.

Confirmado via curl direto na função: retorno `{"ok":true,"skipped":"domingo"}`. No banco existem 39 parcelas elegíveis para D-1 e 16 para D0 hoje.

## Correção

**1. Edge function `notificar-boletos-pendentes`**
- Aceitar flag `force: true` no body para ignorar o bloqueio de domingo (somente uso manual via botões de teste).
- Manter o bloqueio automático nos crons (que não enviam `force`).

**2. Frontend `src/pages/Notificacoes.tsx` (`handleTestRun`)**
- Enviar `{ tipo, force: true }` no invoke dos botões "Testar D-1" / "Testar D0".
- Tratar resposta `skipped` mostrando o motivo (`toast.info("Execução pulada: domingo")` etc.).
- Quando processar, mostrar `total` real e contagem de sucessos/erros.

## Fora de escopo
- Não altera os crons agendados nem a regra de não enviar automaticamente aos domingos.
- Não altera UI da página além do feedback do toast.

## Objetivo

Na aba **Meus Acordos**, transformar o filtro atual de "Criação" (data única) em um filtro de **intervalo (data inicial → data final)**, e reforçar o seletor de usuário já existente para reforçar o fluxo pedido.

## Mudanças

### 1. Filtro de data de criação → intervalo
Arquivo: `src/pages/Acordos.tsx`

- Trocar o estado `filtroDataCriacao: Date | undefined` por `filtroDataCriacaoRange: { from?: Date; to?: Date } | undefined`.
- No popover, trocar `<Calendar mode="single">` por `<Calendar mode="range">` (com 2 meses lado a lado, `numberOfMonths={2}`, locale ptBR).
- Rótulo do botão:
  - Sem seleção: "Filtrar por criação"
  - Só `from`: `Criação: 16/07/2026 →`
  - `from` + `to`: `Criação: 16/07/2026 → 20/07/2026`
- Botão "X" limpa o range inteiro.
- Ajustar o filtro na linha 965 para incluir o acordo quando `criado_em` estiver entre `from` (00:00) e `to` (23:59). Se só `from` existir, comparar por igualdade de dia (comportamento atual).
- Persistir o range em `localStorage` (mesma chave já usada), serializando `from`/`to` como ISO.

### 2. Seletor de usuário
O seletor "Funcionário" (`selectedUserId`, linha 1166) **já existe** ao lado do título "Meus Acordos" e já filtra os acordos por `user_id` do lançador (linha 1014). Nenhuma mudança de lógica é necessária — apenas confirmar que ele continua visível junto do novo filtro de intervalo.

Opcional (para melhorar a descoberta, se quiser): renomear o placeholder de "Funcionário" para "Lançado por" para deixar claro o que o filtro faz. Confirmar antes de aplicar.

## Fora do escopo

- Nenhuma mudança de banco, RLS ou edge function.
- Nenhuma mudança em outras abas/telas.

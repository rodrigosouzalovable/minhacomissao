## Mudança

Na página **Comissões – {Funcionário}** (`/admin/usuarios/:userId/comissoes`), substituir os 4 cards atuais (Total / Paga / Pendente / % Recebido) pelos **2 cards** que já aparecem em "Minhas Comissões":

1. **Total Parcelas Pagas** — soma de `valor_parcela` das parcelas com `status = 'pago'` e `data_paga` dentro do período filtrado (sem filtro = todas as pagas).
2. **Comissão Parcelas Pagas** — soma de `comissao_parcela` das mesmas parcelas pagas no período.

Layout: dois cards lado a lado, ícone `$` no primeiro (verde) e `CheckCircle` no segundo (verde), valor grande em verde — idêntico ao print enviado.

## Arquivos

- `src/pages/UsuarioComissoes.tsx`
  - Remover os 4 cards (linhas 363–400) e o cálculo de `comissaoTotal`/`comissaoPendente`/`percentualRecebido`.
  - Manter `pagamentosFiltradosPorPeriodo` para filtrar a lista de parcelas exibida, mas calcular os dois cards a partir de `pagamentosPagosNoPeriodo`:
    - `totalPagoNoPeriodo = soma(valor_parcela)`
    - `comissaoPagaNoPeriodo = soma(comissao_parcela)`
  - Renderizar grid de 2 colunas com os dois cards.

Sem mudanças em backend, queries ou na tabela de parcelas / abas (Todas, Somente Pagas, Duplicados continuam iguais).

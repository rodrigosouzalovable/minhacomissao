

## Diagnóstico

### 1. Acordos órfãos (sem parcelas) — confirmado no banco

São **8 acordos** criados em 15/04/2026 entre 23:16:48 e 23:17:14 pela usuária Anna Flávia, todos ativos, com 0 registros em `pagamentos`. A `MARIA APARECIDA DIAS` foi removida da lista (já tem parcelas). Lista final a corrigir:

| # | Cliente | CPF | Parcelas | Valor parcela | 1º vencimento | % comissão |
|---|---|---|---|---|---|---|
| 1 | OSMAR ALMEIDA DA SILVA | 00423975102 | 23 | 429,89 | 25/03/2026 | 2% |
| 2 | ILDETE ALVES FEITOSA | 00546560105 | 24 | 364,00 | 10/04/2026 | 2% |
| 3 | RENATO DIAS PIMENTA | 02217119109 | 27 | 210,18 | 25/03/2026 | 2% |
| 4 | IARA NERES PINHEIRO | 02788189354 | 9 | 59,00 | 05/04/2026 | 2% |
| 5 | BEATRIZ CONCEICAO DOS SANTOS | 06832841507 | 24 | 104,08 | 10/04/2026 | 2% |
| 6 | GUILHERME HENRIQUE DE SA MARTINS | 07675820126 | 18 | 55,00 | 06/05/2026 | 0% |
| 7 | WALDEMIR MONTEIRO FERREIRA | 10676333320 | 21 | 351,92 | 08/04/2026 | 2% |
| 8 | MARIA DAS GRACAS CARDOSO | 25589903149 | 11 | 249,21 | 10/04/2026 | 2% |

Confirmei via `LEFT JOIN ... HAVING COUNT = 0` que **estes são os únicos acordos órfãos do sistema inteiro** — não há mais casos semelhantes em outros lotes ou usuários.

### 2. Sistema de lembretes — auditoria completa

Hoje é **16/04/2026**. No banco:
- **26** parcelas vencendo HOJE
- **13** parcelas vencendo em 3 dias (19/04)
- **496** parcelas VENCIDAS (já filtrando casos com parcela posterior paga)

Distribuição por operador: RODRIGO (402) e Anna Flávia (163).

A lógica do hook `usePaymentReminders.tsx` (após o último fix) está correta: busca pendentes com `data_prevista = hoje`, `data_prevista = hoje+3`, `data_prevista < hoje`, e remove parcelas onde existe outra paga com número maior. **Tudo que está no banco aparece nos lembretes** — desde que o operador logado seja o `user_id` do acordo (ou tenha acesso compartilhado).

**Único ponto cego real:** os 8 acordos órfãos acima têm `data_primeiro_pagamento` no passado (alguns desde 25/03), portanto **deveriam estar gerando lembretes de parcelas vencidas** — mas como não têm linhas em `pagamentos`, ficam invisíveis. Corrigir os órfãos resolve também o problema de lembretes faltantes.

## Plano de correção

### Etapa 1 — Gerar parcelas faltantes para os 8 acordos órfãos

Para cada acordo, inserir N linhas em `pagamentos` (N = `acordos.parcelas`) com:
- `numero_parcela`: 1..N
- `data_prevista`: `data_primeiro_pagamento + (i-1) meses`
- `valor_parcela`: vindo de `acordos.valor_parcela`
- `comissao_parcela`: `valor_parcela * percentual_comissao / 100`
- `status`: `'pendente'`

Faço com um único `INSERT ... SELECT ... FROM generate_series(1, parcelas)` filtrando pelos 8 IDs — operação atômica, custo zero, sem mudança de código.

### Etapa 2 — Validação pós-inserção

Re-rodar a query de órfãos (deve retornar zero) e contar parcelas vencidas/hoje/3-dias para confirmar que os novos lembretes apareceram (espera-se ~10–15 parcelas vencidas adicionais entrando no painel de Anna Flávia).

### Etapa 3 — Confirmação para o usuário

Reportar:
- Parcelas geradas por cliente
- Novo total de lembretes "vencidas" para Anna Flávia
- Pedir validação visual abrindo a ficha da Beatriz e o painel de lembretes

### O que NÃO muda

- Nenhum código alterado (correção 100% de dados)
- Hook de lembretes permanece como está (já corrigido na rodada anterior)
- Trigger de CPF duplicado e demais permissões intactas

### Prevenção (opcional, não incluída agora)

Causa raiz: criação de acordo + parcelas em duas chamadas separadas sem transação. Posso, em uma rodada futura, mover a criação completa para uma RPC `criar_acordo_com_parcelas` atômica, eliminando órfãos definitivamente. Aviso antes pelo impacto.


## Problema

Na aba "Acordos da Equipe", o filtro De/Até está olhando a **data de vencimento** da parcela (`data_prevista`). No caso do Antônio Martins Marra, a parcela foi **paga em 05/05/2026** mas vence em **10/05/2026**, então fica fora do intervalo 01/05–08/05 e o acordo desaparece.

## Solução

Voltar o filtro De/Até para usar a **data de pagamento** (`data_paga`) da parcela, considerando apenas parcelas com `status = 'pago'`.

## Alterações em `src/pages/EquipeAcordos.tsx`

1. **`pagamentosFiltradosPorPeriodo`** — voltar a filtrar por `pag.data_paga` (apenas pagamentos com `status = 'pago'` e `data_paga` dentro do intervalo).
2. **`acordosComVencimentoNoPeriodo`** → renomear para `acordosComPagamentoNoPeriodo`. Construir a partir de `pagamentosFiltradosPorPeriodo` (set dos `acordo_id` que têm pelo menos uma parcela paga no período).
3. **Linha 532** — usar `acordosComPagamentoNoPeriodo.has(acordo.id)`.
4. Totais "recebido no período" continuam corretos automaticamente (já usam `pagamentosFiltradosPorPeriodo`).
5. O filtro separado **"Filtrar por vencimento"** (popover de data única) permanece como está, para quem precisar buscar por vencimento.

Sem mudanças em schema, RLS, edge functions ou outras telas.

## Resultado

Com 01/05/2026–08/05/2026, o Antônio aparecerá pois sua parcela foi paga em 05/05/2026.

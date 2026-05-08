## Filtro de datas em "Acordos da Equipe" passa a usar Vencimento da parcela

Hoje o intervalo De/Até filtra acordos pela **data de pagamento** das parcelas. Vou trocar para filtrar pela **data de vencimento** (`data_prevista`) de qualquer parcela do acordo (paga ou pendente). Assim, ao buscar o cliente Antônio Martins Marra entre 01/05/2026 e 08/05/2026, o acordo aparece se houver qualquer parcela com vencimento nesse intervalo.

### Mudanças em `src/pages/EquipeAcordos.tsx`

1. **Lista de acordos (filtro principal)**
   - Substituir o uso de `acordosComPagamentoNoPeriodo` (baseado em `data_paga`) por um novo `Set` `acordosComVencimentoNoPeriodo` construído a partir do mapa já existente `todasDatasPorAcordo` (que contém `data_prevista` de parcelas pagas + pendentes).
   - Acordo entra na lista quando pelo menos uma data em `todasDatasPorAcordo.get(acordo.id)` cair entre `startDate` e `endDate` (comparação por string `YYYY-MM-DD` no fuso local, mesmo padrão já usado no arquivo).

2. **Totais e cards "recebido no período"**
   - Conforme a opção escolhida, os totais de pagamentos passam a considerar parcelas pagas cujo **vencimento** caia no intervalo (não mais a data em que foi pago).
   - Ajustar `pagamentosFiltradosPorPeriodo` para filtrar `pag.data_prevista` em vez de `pag.data_paga`, mantendo o requisito de `status = 'pago'` para os totais financeiros.

3. **Compatibilidade**
   - Sem filtro de datas: comportamento inalterado (todos os acordos).
   - Filtro existente "Vencimento" (data única, popover ao lado) continua funcionando como hoje.
   - Sem mudanças de schema, RLS ou edge functions.

### Fora do escopo
- Demais abas (Meus Acordos, Acordos gerais) permanecem inalteradas.
- Exportação Excel já usa o conjunto filtrado, então herda o novo comportamento automaticamente.

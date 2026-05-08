O Antônio não aparece porque a consulta de pagamentos pagos na aba **Acordos da Equipe** está limitada a `.range(0, 9999)` e não ordena/filtra pelo período selecionado. Como já existem mais de 1.000 pagamentos pagos e o pagamento do Antônio cai depois de muitos registros, ele pode ficar fora do lote carregado no navegador; então o filtro local nunca encontra o `acordo_id` dele, mesmo a parcela paga existindo em 05/05/2026.

Plano de correção urgente:

1. Ajustar a busca de `pagamentos` em `src/pages/EquipeAcordos.tsx` para carregar todos os pagamentos pagos de forma paginada, igual já é feito com `acordos`, evitando limite/truncamento silencioso.
2. Manter o filtro principal **De/Até** usando `data_paga`, conforme aprovado anteriormente.
3. Garantir que o `Set` de acordos com pagamento no período seja montado a partir de todos os pagamentos pagos carregados, incluindo o acordo `967ba068-cff5-4ea8-8d1c-1f22cf938690` do Antônio.
4. Preservar o filtro separado **Filtrar por vencimento** sem alteração.
5. Verificar depois da alteração que o fluxo não depende mais do limite fixo `9999` para pagamentos pagos.
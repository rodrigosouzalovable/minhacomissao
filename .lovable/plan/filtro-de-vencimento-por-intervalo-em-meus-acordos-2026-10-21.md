# Filtro de vencimento por intervalo em Meus Acordos

## Objetivo
Hoje o botão "Filtrar por vencimento" aceita só um dia. Ele passará a aceitar **data início e data fim**, e mostrará todos os acordos (antigos e novos, de qualquer data de criação) que tenham **ao menos uma parcela vencendo dentro do intervalo**.

## Como vai funcionar
- Ao clicar, o calendário permite escolher o primeiro dia e o último dia do período (mesmo formato do "Filtrar por criação").
- O botão mostra "Vencimento: 01/10/2026 – 31/10/2026".
- Se escolher só um dia, filtra apenas aquele dia (como hoje).
- As datas de início e fim entram no resultado.
- Vale em todas as abas (Negociados, Pagos, Sem pagamento etc.) e continua combinando com busca, credor, criação e responsável.
- O "Exportar Excel" passa a exportar o que estiver filtrado pelo intervalo.
- O X continua limpando o filtro; o filtro escolhido continua salvo ao trocar de aba.

## Preservar
- Filtro por criação, regras de parcelas e valores não mudam.
- Nenhuma consulta nova ao servidor: usa as datas de parcelas já carregadas.

## Detalhes técnicos
- `src/pages/Acordos.tsx`: `filtroDataVencimento` passa de `Date` para `DateRange` (`mode="range"`, 2 meses), com migração do valor salvo antigo (data única vira `{from}`).
- `matchesDateFilter`: compara `yyyy-MM-dd` de `todasDatasPorAcordo` com `from`/`to` inclusivos.
- Extrair a regra para função pura testável e adicionar teste (dentro do intervalo, nas bordas, fora, só início).

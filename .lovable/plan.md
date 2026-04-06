

## Plano: Filtro por data de vencimento nas abas de Acordos

### O que será feito

Adicionar um seletor de data em cada aba da página "Meus Acordos". Ao selecionar uma data, apenas os acordos que possuem uma parcela com `data_prevista` igual à data selecionada serão exibidos.

### Implementação

**Arquivo: `src/pages/Acordos.tsx`**

1. Adicionar estado `filtroDataVencimento` (tipo `Date | undefined`)
2. Adicionar um `Popover` com `Calendar` (componente já existente no projeto) logo acima da lista de cards em cada `TabsContent`, ao lado do `BulkSendPanel` quando houver
3. Na lógica de filtragem de cada aba, quando `filtroDataVencimento` estiver definida:
   - Comparar com os Maps já existentes (`dataVencidaPorAcordo`, `dataProximaPorAcordo`) para abas que os usam
   - Para as abas que não têm Map de datas, carregar também um Map geral `dataParcelaPorAcordo` que associa cada `acordo_id` às suas datas de parcelas pendentes (já carregadas no `useEffect` existente)
   - Filtrar: mostrar apenas acordos que tenham pelo menos uma parcela pendente com `data_prevista === dataFormatada`
4. A query existente no `useEffect` que já busca parcelas pendentes será estendida para guardar **todas** as datas de parcelas por acordo (não apenas a mais antiga/próxima), permitindo filtrar por qualquer data
5. Botão de limpar filtro ao lado do date picker

### Detalhes técnicos

- O filtro de data é **adicional** aos filtros de busca e status já existentes
- O estado `filtroDataVencimento` é compartilhado entre as abas (ao trocar de aba, o filtro continua ativo)
- O componente `Calendar` com `Popover` já é usado no projeto (`DateRangePicker.tsx`), então seguiremos o mesmo padrão visual
- Não há necessidade de migration ou mudança no banco


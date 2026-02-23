

# Filtros Avancados para Estrategias de Cobranca

## Objetivo
Adicionar dois novos filtros ao painel de Estrategias de Cobranca:

1. **Tipo de cliente** - Alternar entre clientes que ja possuem acordo no sistema vs devedores que nunca tiveram acordo lancado
2. **Faixa de atraso personalizada** - Dois campos (de/ate) para filtrar por quantidade de dias de atraso

## Detalhes Tecnicos

### 1. Filtro "Tipo de Cliente"

Adicionar um Select com 2 opcoes acima das tabs:
- **Com Acordo Ativo** (padrao atual) - Mostra os acordos ativos ja existentes
- **Sem Acordo** - Busca devedores da tabela `devedores` que NAO possuem nenhum acordo na tabela `acordos` (cruzando por CPF). Exibe nome, CPF, valor original, valor atualizado, credor e dias desde o vencimento

Quando "Sem Acordo" estiver selecionado:
- As tabs de categoria serao ocultadas (nao se aplicam a devedores sem acordo)
- A tabela mostrara colunas diferentes: Nome, CPF, Valor Original, Valor Atualizado, Credor, Dias Vencido
- O botao de exportar Excel continuara funcionando com as colunas adaptadas
- Os cards de resumo mostrarao total de devedores e valor total atualizado

A query para "Sem Acordo" buscara todos os devedores ativos e depois filtrara no frontend removendo aqueles cujo CPF aparece em algum acordo ativo.

### 2. Filtro de Faixa de Atraso

Adicionar dois campos Input (tipo number) lado a lado com labels "De" e "Ate" (em dias), mais um botao "Filtrar":
- Aplica-se a ambos os modos (com acordo e sem acordo)
- No modo "Com Acordo", filtra pelo `max_dias_atraso_parcela`
- No modo "Sem Acordo", filtra pela diferenca entre hoje e `data_vencimento` do devedor
- Quando preenchidos, filtram os dados da tabela apos a segmentacao por categoria
- Botao "Limpar" para remover o filtro de atraso

### Layout dos Filtros

Os filtros ficarao em uma barra horizontal acima das tabs:

```text
[Tipo: Com Acordo Ativo v]   Atraso de [___] ate [___] dias  [Filtrar] [X]
```

### Alteracoes no Arquivo

**Arquivo unico:** `src/components/EstrategiasCobranca.tsx`

- Novos states: `tipoCliente` ('com_acordo' | 'sem_acordo'), `diasAtrasoMin`, `diasAtrasoMax`
- Nova query separada para buscar devedores sem acordo (com `useQuery` e `enabled` condicional)
- Interface `DevedorSemAcordo` para tipar os dados do modo sem acordo
- Colunas Excel adaptadas para cada modo
- Logica de filtro de atraso aplicada via `useMemo` sobre os dados finais
- Importar `Input` de `@/components/ui/input`, `Select` de `@/components/ui/select`, e `Label` de `@/components/ui/label`


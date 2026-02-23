
# Estrategias de Cobranca - Painel de Analise de Carteira

## Objetivo
Criar uma secao "Estrategias" abaixo da secao "Equipes" na pagina `/admin/equipes` que segmenta automaticamente os acordos ativos em categorias estrategicas de cobranca, ajudando a identificar os melhores clientes para priorizar acionamentos.

## Segmentacoes Estrategicas

Com base em boas praticas de cobranca e nos dados disponiveis (acordos, pagamentos, dias de atraso), os clientes serao classificados em 6 categorias:

1. **Pagadores Parciais** - Clientes que ja pagaram pelo menos 1 parcela mas pararam. Sao os de MAIOR probabilidade de retorno pois ja demonstraram intencao de pagar.

2. **Parcela Unica Pendente** - Acordos com apenas 1 parcela restante. Facil conversao pois o cliente esta proximo de quitar.

3. **Inadimplentes Recentes (ate 30 dias)** - Clientes com parcelas vencidas ha menos de 30 dias. A janela de recuperacao e alta nesse periodo.

4. **Inadimplentes Moderados (31-90 dias)** - Clientes com atraso moderado. Necessitam abordagem mais incisiva mas ainda ha boa chance.

5. **Nunca Pagaram** - Clientes que nao pagaram nenhuma parcela do acordo. Exigem reavaliacao da estrategia de contato.

6. **Alto Valor Pendente (top 50)** - Os 50 acordos com maior valor pendente, independente do status de pagamento. Prioridade pelo impacto financeiro.

## Arquitetura

### Novo componente: `src/components/EstrategiasCobranca.tsx`

Componente separado para manter o `AdminEquipes.tsx` limpo. Contera:

- Tabs para alternar entre as 6 categorias
- Cards de resumo no topo (total de clientes, valor pendente total)
- Tabela com os clientes da categoria selecionada: Nome, CPF, Valor Total, Parcelas Pagas/Total, Valor Pendente, Dias de Atraso, Funcionario
- Botao "Exportar Excel" que baixa os clientes da aba ativa
- Badge com quantidade de clientes em cada aba

### Dados

Uma unica query busca todos os acordos ativos com seus pagamentos e os processa no frontend para classificacao:

```text
acordos (status = 'ativo')
  + pagamentos (agregados: parcelas_pagas, parcelas_pendentes, total_pago, total_pendente)
  + profiles (nome do funcionario)
```

Nao sera necessaria nenhuma alteracao no banco de dados. A logica de segmentacao sera feita no frontend com os dados ja disponiveis.

### Integracao na pagina

O componente `EstrategiasCobranca` sera importado e renderizado no `AdminEquipes.tsx` logo apos o card de "Equipes", envolvido em um Card com icone e titulo "Estrategias de Cobranca".

### Exportacao Excel

Cada aba tera um botao "Exportar Excel" que usa a funcao `exportarParaExcel` ja existente no projeto para gerar uma planilha com as colunas: Cliente, CPF, Valor Total, Parcelas Pagas, Parcelas Pendentes, Valor Pago, Valor Pendente, Dias Atraso, Funcionario.

### Detalhes tecnicos

- Query com `useQuery` para acordos ativos + join manual com pagamentos e profiles
- Funcoes de filtro puras para cada categoria
- `useMemo` para evitar recalculos desnecessarios
- Tabs do Radix UI (ja disponivel no projeto)
- Reutiliza componentes existentes: Card, Table, Badge, Button, Tabs
- Reutiliza `exportarParaExcel` de `src/lib/exportExcel.ts`

## Sem IA

A segmentacao e puramente baseada em regras e dados estruturados, nao necessitando de integracao com IA. Os criterios sao objetivos (parcelas pagas, dias de atraso, valor pendente) e mais confiaveis que uma classificacao por modelo de linguagem.

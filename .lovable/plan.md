# Histórico de meses anteriores no Dashboard

Novo card acima da "Meta do Mês" para consultar o resultado de meses passados.

## O que será construído

- Card "Resultado de meses anteriores" no topo do Dashboard, logo acima do bloco de meta do mês (tanto para funcionário quanto para admin).
- Um seletor de mês (últimos 12 meses, ex.: "Julho 2026") e um botão "Ver resultado".
- Ao confirmar, abre um dialog com:
  - Valor total recebido no mês selecionado
  - Quantidade de parcelas pagas
  - Meta do mês (se houver) e % de atingimento, com barra de progresso
  - Ticket médio por parcela
- Escopo dos dados: funcionário vê apenas seus próprios acordos. Admin vê duas visões no dialog: "Meu resultado" e "Total da equipe".

## Detalhes técnicos

- Novo componente `src/components/HistoricoMesesCard.tsx`, inserido em `src/pages/Dashboard.tsx` antes de `MetaMesBanner` / `MetasMensal`.
- Consulta com `useQuery` (chave por usuário + mês, `staleTime` alto, sem polling — só busca ao abrir o dialog, para não gerar custo extra):
  - Pagamentos: `pagamentos` filtrados por `status = 'pago'` e `data_paga` dentro do mês, cruzando com os `acordos` do usuário (mesmo padrão de `useMetaMes`).
  - Para a visão de equipe (admin): agregação por RPC/consulta admin já existente (`comparativo_mensal_global` ou `ranking_mensal`), sem trazer linhas individuais.
  - Meta: `metas_funcionarios` por `mes_ano` (`yyyy-MM`); para equipe, `metas_mensais`.
- UI com componentes shadcn existentes (Card, Select, Dialog, Progress, Badge) e tokens semânticos, sem cores fixas.
- Sem mudanças de banco de dados.

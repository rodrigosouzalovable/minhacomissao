## Objetivo

1. Reexecutar manualmente a edge function `consultar-cotacao-diaria` para validar o envio das mensagens de cotação aos números 62991672674 e 62994300880.
2. Criar nova aba **Cotações** no sistema para acompanhamento visual das moedas USD/EUR, destacando sempre o menor valor histórico.

---

## 1) Teste de envio

- Invocar `consultar-cotacao-diaria` via `supabase--curl_edge_functions` (com idempotência do dia — se já foi enviado hoje, forçar via chave alternativa `cotacao-manual-<timestamp>` num parâmetro opcional).
- Ajuste mínimo na função: aceitar body opcional `{ forcar?: boolean }` que ignora a idempotência quando `true`, permitindo reenvio manual sem esperar 24h.
- Consultar `admin_notificacoes_log` após execução para confirmar entrega em ambos os números.

## 2) Nova aba "Cotações"

### Página `src/pages/Cotacoes.tsx`
- Header com título + subtítulo explicando o evento (data base 15/07/2026).
- **2 cards de destaque grandes** (USD e EUR):
  - Valor atual do dia
  - Valor mínimo histórico (em destaque com borda/badge dourado ou verde, ícone TrendingDown)
  - Data do mínimo registrado
  - Variação % entre atual e mínimo
- **Gráfico de linha** (recharts, já disponível) com histórico dos últimos 30 dias por moeda.
- **Tabela** com histórico completo (data, USD, EUR), marcando linhas que bateram mínimo com badge "Menor registrado".
- Botão "Atualizar cotação agora" (admin-only) que chama a edge function com `forcar:true`.

### Roteamento e nav
- Adicionar rota `/cotacoes` em `src/App.tsx`.
- Adicionar item de menu "Cotações" (ícone `DollarSign` ou `TrendingUp`) em `src/components/layout/AppLayout.tsx`, restrito a admin (segue padrão das outras abas administrativas).

### Acesso
- Query direta em `cotacoes_moedas` e `cotacoes_minimas` via cliente supabase. RLS já restringe a admin (via `has_role`).

---

## Detalhes técnicos

- Sem novas tabelas nem migrations — reusa `cotacoes_moedas` e `cotacoes_minimas` criadas anteriormente.
- Sem novos cron jobs, sem polling. `useQuery` com `staleTime` alto (5min) — sem impacto de custo.
- Edge function editada: `consultar-cotacao-diaria` (parâmetro `forcar`).
- Arquivos criados: `src/pages/Cotacoes.tsx`.
- Arquivos editados: `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `supabase/functions/consultar-cotacao-diaria/index.ts`.

## Impacto de custo

Desprezível — página lê 2 tabelas pequenas sob demanda, sem realtime nem refetch automático.

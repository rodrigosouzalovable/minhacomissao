# Nova aba "Relatórios" — Acionamentos hora a hora

## Visão geral
Criar nova página `/relatorios` no menu lateral com tabela horária (8h-19h) de métricas de acionamento, integrada com criação de acordos para somar valores automaticamente.

## Banco de dados (migração)

**Tabela `relatorio_acionamentos`**
- `data` (DATE), `hora` (TEXT: '8h-9h'...'18h-19h')
- `tentativas`, `alo`, `cpc`, `cpca` (INTEGER default 0)
- `acordos_valor` (NUMERIC default 0)
- `atualizado_por` (UUID → profiles), `atualizado_em`
- UNIQUE (data, hora)

**Tabela `relatorio_acionamentos_log`**
- `usuario_id`, `acao`, `data`, `hora`, `valor_anterior`, `valor_novo`, `created_at`

**Tabela `relatorio_acionamentos_meta`**
- `data` (DATE PK), `meta_valor` (NUMERIC), atualizado_por

**Função RPC `incrementar_metrica_acionamento(p_data, p_hora, p_coluna)`**
- SECURITY DEFINER. Faz upsert + incremento atômico + grava log. Cooldown server-side opcional (rejeita se mesmo usuário/coluna/hora em <2s).

**Trigger em `acordos` (AFTER INSERT)**
- Calcula faixa horária a partir de `criado_em` (timezone America/Sao_Paulo)
- Se entre 8h-19h: upsert + soma `valor_total` em `acordos_valor` da linha correspondente
- Insere log com `acao='acordo_criado_auto'`

**RLS / GRANT**
- `authenticated`: SELECT em todas; INSERT/UPDATE apenas via RPC (security definer)
- Admin: UPDATE direto em `acordos_valor` e `meta_valor`
- Log: SELECT só admin; INSERT via função

## Frontend

**`src/pages/Relatorios.tsx`** (nova rota lazy em `App.tsx` dentro de `PermissionRoute`)
- Header: título com data atual formatada (pt-BR) + subtítulo
- Card de progresso: "Acordos hoje", "Meta", "% atingido" (barra de progresso)
- Botões topo: Resetar dia (admin, com confirm), Exportar CSV, Ver relatório anterior (date picker)
- Tabela 11 linhas + 2 linhas rodapé (TOTAL e MÉDIA)
  - Células com botão `+` (lucide `Plus`) ao lado do número para tentativas/alo/cpc/cpca
  - Cooldown client-side 2s por célula (state local com timestamps)
  - Coluna `$ ACORDOS`: formato R$, editável inline só para admin
  - Colunas %: calculadas em memória, 2 casas decimais, "0%" quando divisor zero
  - Destaque 🏆 na hora com maior `acordos_valor`
- Gráfico de barras (recharts, já no projeto) `acordos_valor` por hora
- Realtime: subscribe em `postgres_changes` da tabela do dia para atualizar todos clientes

**Sidebar** (`src/components/layout/AppLayout.tsx`): adicionar item "Relatórios" com ícone (ex.: `BarChart3`), apontando para `/relatorios`. Considerar em `useUserPermissions` para gating não-admin.

**CSV export**: gerar localmente com as linhas do dia (sem precisar de lib extra).

## Pontos de atenção
- Trigger no `acordos` deve usar timezone `America/Sao_Paulo` para a faixa horária
- RPC de incremento é única via de escrita do funcionário (mantém log e atomicidade)
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.relatorio_acionamentos;`
- Médias ignoram horas com divisor zero (média apenas das horas com valor válido)

## Arquivos
- `supabase/migrations/<novo>.sql` — tabelas, GRANTs, RLS, RPC, trigger, publication
- `src/pages/Relatorios.tsx` — nova página
- `src/App.tsx` — rota lazy
- `src/components/layout/AppLayout.tsx` — item de menu

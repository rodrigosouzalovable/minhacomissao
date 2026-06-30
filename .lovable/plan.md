## Viabilidade

Totalmente viável e a maior parte da infraestrutura já existe:

- `meta_whatsapp_instances` já tem `tier_diario`, `enviados_hoje`, `ultimo_reset`, `saude_quality`, `saude_tier`.
- `meta_whatsapp_envios_log` já registra cada envio com `instancia_id`, `telefone`, `template_nome`, `status`, `enviado_em` — base suficiente para contar clientes únicos e mensagens por número/dia.
- Já existem edge functions `send-whatsapp-meta` e `check-meta-instance-health`.
- A aba "Envio Meta Massa" (`src/pages/EnvioMeta.tsx`) já faz disparo round-robin com instâncias.

Não precisa migrar dados existentes. O plano abaixo entrega o painel **acoplado à aba Envio Meta Massa atual** (sem criar uma nova rota separada), conforme pediu.

## Escopo entregue

### 1. Banco de dados (migração)

- Nova tabela `meta_envios_meta_diaria`:
  - `data date` (PK junto com `user_id`)
  - `user_id uuid` (dono do plano de escalonamento)
  - `meta_clientes_unicos int`
  - `dia_numero int` (1..N do plano)
  - `plano_inicio date`, `plano_objetivo_unicos int` (default 1000), `plano_dias int` (default 7)
  - timestamps + RLS (`auth.uid() = user_id` ou admin) + GRANTs.

- Nova tabela `meta_envios_fila` (fila de clientes priorizada):
  - `id`, `user_id`, `nome`, `telefone`, `telefone_norm` (últimos 8), `cpf`, `valor numeric`, `atraso_dias int`, `prioridade int`, `status text` (`pendente|enviado|erro|sem_whatsapp`), `enviado_em`, `instancia_id`, `template_id`, `cooldown_ate date`, timestamps.
  - Índice em (`user_id`, `status`, `prioridade desc`).
  - RLS por `user_id` + GRANTs.

- Função `meta_envios_resumo(_uid uuid, _ate date)` (SECURITY DEFINER) retornando jsonb com:
  - clientes únicos hoje, 7d, % progresso, enviados hoje total, por instância, projeção (dias para 1000).
  - Conta unicidade por `telefone` em `meta_whatsapp_envios_log` com `status <> 'failed'`.

- (Sem alterar `meta_whatsapp_envios_log` — já é suficiente.)

### 2. UI — nova seção dentro de `src/pages/EnvioMeta.tsx`

Adicionar no topo da página (acima do bloco atual de destinatários) um **painel "Controle de Escalonamento"** colapsável, dividido em sub-cards:

**a) Cards de resumo** (`src/components/meta/escalonamento/ResumoCards.tsx`):
- Meta diária hoje · Únicos hoje · Únicos 7d / 1.000 (barra) · Limite tier atual · Enviadas hoje.

**b) Tabela de plano 7 dias** (`PlanoEscalonamentoTable.tsx`):
- Linhas Dia 1..9 com meta/acumulado/%/ação. Recalcula automaticamente a meta dos dias restantes se o usuário ficar abaixo do ritmo.
- Botão "Reiniciar plano" e "Ajustar objetivo".

**c) Tabela por número** (`InstanciasEnvioTable.tsx`):
- Por instância: enviados hoje, únicos hoje, qualidade (`saude_quality`), tier, status. Botão "Disparar lote" (usa fila + meta restante do dia, dividida igualmente entre instâncias ativas com qualidade ≠ baixa).

**d) Fila de clientes** (`FilaClientesPanel.tsx`):
- Importar planilha (mesmo parser já usado), preview, deduplicar contra `meta_envios_fila` e contra envios dos últimos N dias (cooldown).
- Ordenação automática: maior atraso → maior valor → mais antigo.
- Marcar como enviado/erro/sem WA reaproveitando o fluxo de validação UAZAPI já existente.

**e) Gráficos** (`EvolucaoEnviosChart.tsx`):
- Linha: únicos por dia (7d) usando recharts (já instalado no projeto).
- Pizza: distribuição por número hoje.

**f) Alertas** (banner no topo do painel):
- Abaixo do ritmo (amarelo) / acima (verde) / qualidade caiu (vermelho + pausa) / 80% do tier (laranja). Reaproveita `saude_quality` e `enviados_hoje`.

### 3. Lógica de disparo

- Estender `EnvioMetaSendingContext` para aceitar `origem: "fila"` e, ao enviar, dar `UPDATE` em `meta_envios_fila` (status, instancia_id, enviado_em) em batch a cada N envios.
- Botão "Disparar lote do dia" calcula `restante = meta_hoje - unicos_hoje`, pega os próximos `restante` itens da fila ordenada, divide round-robin entre instâncias selecionadas (qualidade ≠ baixa, com tier disponível) e dispara usando o pipeline atual de `send-whatsapp-meta`.
- Cooldown: ao inserir na fila, marcar `cooldown_ate = hoje + 7 dias` para o número.

### 4. Hooks novos

- `useMetaEscalonamento(userId)` — lê `meta_envios_meta_diaria` + RPC `meta_envios_resumo` (refetch a cada 30s + ao final de cada envio).
- `useMetaFila(userId)` — CRUD da fila, paginação, filtros (status/prioridade), com `useInfiniteQuery`.

### 5. Configurações

Reaproveitar o card de delay já existente; adicionar inputs persistidos em `system_settings` (ou em `meta_envios_meta_diaria` linha "config"):
- Meta diária inicial (30), dias objetivo (7), objetivo final (1000), cooldown (7), max/h (50), proporção utility/marketing (informativa).

### 6. Relatórios

- Botão "Exportar CSV" usando `exportarParaExcel` que já existe — exporta `meta_whatsapp_envios_log` filtrado por período.

## Fora do escopo desta entrega

- Nova rota/aba separada: ficará dentro de "Envio Meta Massa" para não duplicar UI.
- Cron de reset diário do plano: o reset usa a função `meta_envios_resumo` em tempo real; não precisa de pg_cron agora.
- Notificações push/WhatsApp para o admin sobre alertas — apenas badges visuais nesta primeira versão.

## Ordem de implementação

1. Migração (tabelas + RPC + RLS + GRANTs).
2. Hooks (`useMetaEscalonamento`, `useMetaFila`).
3. Sub-componentes do painel + integração em `EnvioMeta.tsx`.
4. Lógica de "Disparar lote do dia" no `EnvioMetaSendingContext`.
5. Gráficos e exportação CSV.
6. Smoke test: criar plano, importar 50 clientes, disparar lote em 2 instâncias, conferir contadores e gráficos.

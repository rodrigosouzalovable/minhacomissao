# Plano de Economia — Lovable Cloud

## Diagnóstico (o que consumiu os US$ 10)

Rodei o diagnóstico do banco. O gasto NÃO é de disco (20%) nem de memória (49%). É **compute/egress** por volume absurdo de queries repetidas do PostgREST:

| Query | Chamadas | Tempo total |
|---|---|---|
| `whatsapp_contatos` listagem com JOIN LATERAL | **665.299** | 48h de CPU |
| `whatsapp_contatos` telefones | 629.940 | 21h |
| `pagamentos` (order by acordo_id) | 194.573 | 16h |
| `whatsapp_contatos` count | 590.569 | 16h |
| `pagamentos` (parcelas vencidas) | 194.573 | 4h |
| `meta_whatsapp_contatos` listagem | 50.176 | 1,9h |

Além disso: **1.553.507 transações revertidas** desde o boot — provavelmente RLS negando ou erros em cascata em loops de polling.

**Causa provável**: hooks React (useEffect/useQuery/Realtime) recarregando a lista de conversas do Inbox, pagamentos do Dashboard e reminders repetidamente, sem cache, sem debounce e sem paginação eficiente.

---

## Ações (ordenadas por retorno)

### 1. Adicionar índices que faltam (impacto imediato, custo zero)
Uma migration com:
- `whatsapp_contatos (instancia_id, arquivado, ultima_mensagem_em DESC)` — cobre as 3 queries mais caras
- `whatsapp_contatos (instancia_id, arquivado, nao_lido)` — cobre count de não lidos
- `meta_whatsapp_contatos (arquivado, ultima_mensagem_em DESC)`
- `pagamentos (status, data_prevista)` — parcelas vencidas
- `pagamentos (acordo_id, status)` — join com acordos

Reduz o tempo médio de cada query de 100–300ms para <20ms → menos CPU-segundo cobrado.

### 2. Cortar frequência de polling do frontend
Aumentar `staleTime` e `refetchInterval` dos useQuery pesados:
- Inbox contatos: de "sempre" para `staleTime: 30s`
- Pagamentos/Dashboard: `staleTime: 60s`
- Metas/rankings: `staleTime: 5min`

Trocar polling por Realtime só onde já existe canal, e ligar polling de fallback só quando a aba está visível (`document.visibilityState === 'visible'`).

### 3. Paginar e limitar SELECTs
- Inbox: `limit(50)` na listagem inicial + infinite scroll (hoje traz tudo).
- Dashboard de pagamentos: usar RPC agregado em vez de `select *` de `pagamentos`.

### 4. Cron/edge functions
Auditar crons em `supabase/functions/`. Muitos rodam a cada minuto (aquecimento, monitor, notificações). Reduzir onde possível:
- `daily-report-*`: já são diários → OK
- Monitores contínuos: aumentar intervalo de 1min → 5min

### 5. Guardrail no editor Lovable
Adicionar à memória do projeto uma regra core:
> **Antes de qualquer alteração que aumente custo em Lovable Cloud (nova tabela pesada, novo cron, novo polling, novo Realtime, novo edge function em loop), a IA deve exibir: `⚠️ ALERTA DE CUSTO ALTO LOVABLE CLOUD` com estimativa do impacto e aguardar confirmação.**

Já existe memory `cloud-cost-awareness` — vou reforçá-la e adicionar o texto exato do alerta na regra Core do `mem://index.md`.

---

## Detalhes técnicos

- Migration com `CREATE INDEX IF NOT EXISTS` (sem CONCURRENTLY — roda dentro da migration).
- Todos os índices usam colunas já presentes em WHERE/ORDER BY das queries do pg_stat_statements.
- Ajustes de `staleTime` são só no cliente (React Query); zero mudança de schema/regra de negócio.
- Nenhum recurso será removido — só reduzido em frequência.
- Fora de escopo: reescrever Inbox (grande refactor); ajustar RLS que causa rollbacks (precisa investigação separada).

---

## Escopo fora
- Não vou mexer em lógica de aquecimento, envio, cobrança, permissões.
- Não vou desativar features — só otimizar acessos ao banco.
- Não vou tocar em `client.ts`, `types.ts`, `.env`, `config.toml`.

Após sua aprovação, aplico as ações 1, 2, 4 e 5 numa única passada. Ação 3 (paginação do Inbox) fica opcional — me avise se quer incluir.

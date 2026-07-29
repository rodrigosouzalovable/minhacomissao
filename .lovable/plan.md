# Otimização de CPU do Banco (100% → alvo ~30-40%)

Baseado nas 4 queries que mais consomem CPU no seu banco agora. O objetivo é reduzir uso sem precisar fazer upgrade da instância.

## 1. Polling do progresso de campanhas Meta (maior ofensor)

**Problema:** ~650 mil consultas em `envio_meta_job_item` filtrando por `job_id` + `status`. A tela de detalhes da campanha (`CampanhaDetalheDialog`) e o painel flutuante (`CampanhasFlutuante`) fazem refetch muito rápido, mesmo com aba em segundo plano.

**Correções:**
- Subir `refetchInterval` de campanhas em andamento para 5-10s (hoje deve estar em 1-2s).
- Parar refetch quando `document.visibilityState !== "visible"` (aba fora de foco).
- Parar refetch quando o job estiver em status final (`concluido`, `erro`, `cancelado`).
- Garantir índice composto `(job_id, status, processado_em DESC)` em `envio_meta_job_item` — a query atual ordena por `processado_em DESC`, então esse índice elimina o sort.

## 2. Polling do log de envios Meta

**Problema:** ~1 milhão de consultas em `meta_whatsapp_envios_log` filtrando por `user_id` + `enviado_em`. É o Monitor de Envios e telas de status.

**Correções:**
- `staleTime` alto (60s) + `refetchInterval` mínimo 30s no hook que consulta esse log.
- Guard de `visibilityState`.
- Índice `(user_id, enviado_em DESC)` se ainda não existir.

## 3. Inbox Meta / WhatsApp - lista de contatos

**Problema:** ~665 mil consultas em `whatsapp_contatos` com JOIN em `user_whatsapp_instances`, ordenado por `ultima_mensagem_em`.

**Correções:**
- Aumentar `staleTime` da lista de contatos (30-60s) e depender do Realtime pra novidades em vez de polling.
- Guard de `visibilityState` no refetch periódico.
- Índice `(instancia_id, arquivado, ultima_mensagem_em DESC)`.

## 4. Full-scan em `pagamentos` (query mais perigosa)

**Problema:** SELECT em `pagamentos` **sem WHERE**, ordenado por `acordo_id`, paginado por OFFSET. Isso varre a tabela inteira em cada chamada — 269 mil execuções, média 512ms.

**Correções:**
- Localizar a chamada (provavelmente uma tela que faz `.from('pagamentos').select(...)` sem `.eq('acordo_id', ...)` ou `.in('acordo_id', [...])`) e passar a filtrar sempre por `acordo_id` ou por `user_id` via join implícito.
- Se realmente precisa varrer, mudar para paginação por keyset (cursor em `acordo_id`) em vez de OFFSET, ou consumir via RPC agregada.
- Índice `(acordo_id)` — já é PK provavelmente, então o problema é a query, não o índice.

## Detalhes técnicos

**Arquivos que devem ser tocados (frontend):**
- `src/components/meta/CampanhaDetalheDialog.tsx` e `src/components/meta/CampanhasFlutuante.tsx` — ajustar refetchInterval + visibility guard + parar em status final.
- Hook do Monitor de Envios Meta (procurar quem lê `meta_whatsapp_envios_log`) — subir staleTime.
- `src/pages/InboxMeta.tsx` e hooks de `whatsapp_contatos` — subir staleTime, remover polling redundante, manter Realtime.
- Localizar o consumidor que faz SELECT em `pagamentos` sem filtro (candidatos: `EquipeAcordos.tsx`, `Comissoes.tsx`, `Dashboard.tsx`, `MetaBillingConciliacaoCard.tsx`) e restringir por `acordo_id`/`user_id`.

**Migração de índices (uma migração só, com `CREATE INDEX IF NOT EXISTS`):**
```sql
CREATE INDEX IF NOT EXISTS idx_envio_meta_job_item_job_status_proc
  ON public.envio_meta_job_item (job_id, status, processado_em DESC);
CREATE INDEX IF NOT EXISTS idx_meta_envios_log_user_enviado
  ON public.meta_whatsapp_envios_log (user_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_inst_arq_ult
  ON public.whatsapp_contatos (instancia_id, arquivado, ultima_mensagem_em DESC);
```

**Padrão de visibility guard** que vou aplicar nos hooks:
```ts
useQuery({
  queryKey: [...],
  queryFn: ...,
  staleTime: 30_000,
  refetchInterval: (q) => document.visibilityState === "visible" ? 10_000 : false,
  refetchIntervalInBackground: false,
});
```

## Ordem de execução

1. Rodar a migração dos 3 índices (efeito imediato no custo por query).
2. Ajustar refetchIntervals + visibility guards nos 4 pontos.
3. Corrigir a query de `pagamentos` sem filtro.
4. Reavaliar CPU depois de ~15 min de uso real; se ainda estiver alto, considerar upgrade da instância.

## Risco

Baixo. São mudanças de frequência de refetch e índices adicivos — nada muda de comportamento visível pro usuário, só fica mais leve. O único ponto que exige atenção é a query de `pagamentos`: preciso identificar o call-site exato antes de mudar, pra não quebrar uma tela.
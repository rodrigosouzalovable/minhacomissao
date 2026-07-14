## Objetivo
Em "Envio Meta Massa", quando uma instância selecionada começar a dar erro durante a campanha, ignorá-la automaticamente e continuar os envios apenas com as demais instâncias funcionando — sem cancelar o job.

## Comportamento atual
Hoje, se uma instância retorna erro no `send-whatsapp-meta`, o item é marcado como `erro` e no próximo tick o `pick-meta-instance` pode escolher a mesma instância de novo, gerando uma sequência de falhas. Só há bloqueio automático quando a Meta marca a instância como restrita (pausa_automatica_ate) ou quando qualidade cai (YELLOW/RED).

## Mudança
Adicionar uma "lista negra por job" em memória no próprio registro do job:

1. Novo campo `instancias_bloqueadas_run` (jsonb array de UUIDs) em `envio_meta_job` — instâncias que falharam nesta execução e devem ser ignoradas até o job terminar.

2. No `envio-meta-massa-tick`, ao chamar `pick-meta-instance`, passar `instancia_ids` filtrado removendo as bloqueadas do job.

3. Quando `send-whatsapp-meta` retorna falha real (não `tier_full`, não `pool_blocked`, não `domingo/horario`), contabilizar falhas consecutivas por instância dentro do job. Após **2 falhas consecutivas** da mesma instância, adicioná-la a `instancias_bloqueadas_run` e reenfileirar o item atual (voltar para `pendente`) para ser tentado por outra instância.

4. Se sobrarem instâncias válidas (selecionadas − bloqueadas), o loop continua normalmente. Se todas forem bloqueadas, o job encerra com status `erro` e motivo "Todas as instâncias falharam" (usando o fluxo `encerrarJobSemDisponibilidade` já existente), disparando a notificação com a lista de instâncias bloqueadas.

5. Notificação de conclusão passa a listar também as instâncias que foram auto-ignoradas durante o envio (além das restringidas pela Meta).

## Detalhes técnicos
- Migration: `ALTER TABLE envio_meta_job ADD COLUMN instancias_bloqueadas_run jsonb NOT NULL DEFAULT '[]'::jsonb;` (sem novas RLS/GRANTs, tabela já existe).
- Contador em memória por tick não persiste bem entre invocações → usar coluna auxiliar `falhas_por_instancia_run jsonb DEFAULT '{}'` mapeando `instancia_id → contador`.
- Limite configurável no código: `MAX_FALHAS_CONSECUTIVAS = 2`.
- Ao reenfileirar item por bloqueio de instância: `status=pendente`, `instancia_id=null`, `instancia_nome=null`, sem incrementar `erros`.
- Falhas que resultam em bloqueio de instância continuam contando em `envio_meta_job_item.status='erro'` só se não houver mais instâncias para tentar; caso contrário o item volta para pendente.
- Frontend (`CampanhaDetalheDialog.tsx`): mostrar chip informativo "Instâncias ignoradas nesta campanha: N" quando `instancias_bloqueadas_run.length > 0`, listando nomes.

## Arquivos afetados
- Nova migration SQL (colunas em `envio_meta_job`).
- `supabase/functions/envio-meta-massa-tick/index.ts` — filtro de instâncias, contador de falhas, reenfileiramento, atualização da notificação final.
- `src/components/meta/CampanhaDetalheDialog.tsx` — badge/lista de instâncias auto-ignoradas.

Sem alterações em `pick-meta-instance` (já aceita qualquer `instancia_ids`), `send-whatsapp-meta`, RLS ou UI de iniciar campanha.

## Objetivo

Ao clicar em "Tentar novamente" no dialog da campanha (modo rajada), redistribuir os itens com erro para as instâncias **ativas/saudáveis** do job — em vez de re-enfileirar mantendo a instância que falhou (ex.: LD 19 com "Business eligibility payment issue"). Assim, os retries saem pela instância que ainda está enviando (ex.: LD 14).

## Comportamento

- Retry pega todos os itens `status='erro'` do job e volta para `pendente`.
- Identifica quais instâncias do job (`job.instancia_ids`) estão **elegíveis agora**: `ativo=true`, não `estado_pool='restrita'`, sem `pausa_automatica_ate` no futuro (motivos como `status=…`, template pausado, eligibility issue). Em rajada, RED/YELLOW continuam elegíveis.
- Se houver ao menos 1 instância elegível: reatribui `instancia_id` dos itens resetados via round-robin sobre as elegíveis, e dispara `envio-meta-massa-burst` apenas para essas.
- Se nenhuma estiver elegível: mantém comportamento atual (retorna erros ao pool original) e devolve mensagem clara `"Nenhuma instância elegível para retomar"` para o front exibir o toast.
- Modo serial (`modo_rajada=false`): sem mudança — o `pick-meta-instance` já escolhe entre as ativas.

## Arquivos alterados

### `supabase/functions/envio-meta-massa-retry-erros/index.ts`
1. Após o UPDATE que devolve itens para `pendente` (linha 58-63), quando `job.modo_rajada`:
   - Buscar `meta_whatsapp_instances` para `job.instancia_ids` e filtrar as elegíveis (mesma regra do `pick-meta-instance`, sem checagem de qualidade).
   - Se `elegiveis.length > 0`, fazer UPDATE em lote reatribuindo `instancia_id` dos itens resetados por round-robin (um `update` por instância usando `.in('id', chunkIds)`).
   - Substituir o loop de dispatch (linhas 85-95) para chamar `envio-meta-massa-burst` apenas para as instâncias elegíveis.
2. Se `elegiveis.length === 0`, retornar `success:false, error:'Nenhuma instância elegível para retomar (todas pausadas/restritas)'` com status 200 sem re-disparar workers.

Nenhuma alteração de UI necessária — o `CampanhaDetalheDialog` já exibe o toast com a mensagem retornada.

## Problema

Quando uma instância volta `status=BANNED` no meio da campanha, o worker rajada:

1. Marca os pendentes daquela instância como **erro** (`"Instância indisponível pela Meta (status=BANNED)"`) — foi o que aconteceu na campanha CSIM 13 do print (164 erros de uma vez).
2. Não redistribui esses contatos para a instância boa.
3. Resultado: você precisa clicar "Tentar novamente" manualmente para reprocessar.

O caminho para `#132015` (template pausado) já faz a redistribuição correta. Vou espelhar essa mesma lógica para o caso BANNED / FLAGGED / RESTRICTED / BA locked.

## O que vou mudar

**Arquivo:** `supabase/functions/envio-meta-massa-burst/index.ts`

1. No bloco que detecta instância restrita (linhas ~242-298), substituir o "marca pendentes como erro" por:
   - Adicionar `instanciaId` a `instancias_bloqueadas` do job (já faz).
   - Devolver itens ainda em `processando`/`pendente` desta instância para `pendente`.
   - **Recuperar** itens já marcados como `erro` com mensagem contendo `status=BANNED`, `status=FLAGGED`, `status=RESTRICTED`, `indisponível pela Meta` ou `#131031` — voltam para `pendente` (e desconta do contador `erros` do job).
   - Se ainda existem instâncias ativas no `job.instancia_ids` fora das bloqueadas: **round-robin** os pendentes órfãos entre as ativas (`UPDATE envio_meta_job_item SET instancia_id = ...`) e disparar `selfInvoke` para cada ativa.
   - Só encerrar o job com status `erro` se **todas** as instâncias caíram (aí sim marca os restantes como erro final e notifica admin — mantém o comportamento atual desse sub-caso).
   - Notificar admin com chave idempotente `meta_instancia_restrita_${jobId}_${instanciaId}` avisando que a instância foi retirada e X contatos foram redistribuídos.

2. Extrair a lógica de "desativar instância no job + redistribuir pendentes" numa função interna reutilizável (`desativarInstanciaERedistribuir`) para o template pausado e o BANNED usarem o mesmo caminho, evitando divergência.

3. No branch inline `restrictedVisto` (linhas 417-421 e 470-474), em vez de só quebrar o loop e esperar 60s, chamar direto essa nova função para redistribuir imediatamente — sem esperar a próxima invocação.

## Fora do escopo

- Não altero `send-whatsapp-meta` — ele já retorna `instance_restricted:true` corretamente para BANNED.
- Não altero a UI. A campanha CSIM 13 aberta agora vai continuar mostrando os 164 erros antigos até que o worker rode de novo; na próxima invocação (ou ao clicar "Atualizar") o próprio worker vai reciclar esses erros de BANNED e mandar para a instância boa automaticamente — como já fazemos para rate limit.

## Resultado esperado

Ao detectar `status=BANNED` numa instância:
- Ela sai da campanha sozinha.
- Todos os contatos que estavam com ela (pendentes + erros antigos por BANNED) vão automaticamente para as outras instâncias ativas via round-robin.
- O envio continua sem clique manual.
- Job só encerra em erro se **todas** as instâncias forem banidas.

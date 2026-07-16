## Problema

CSIM 6: 47 falhas e 0 aceitos. Todas com erro `#131042 Business eligibility payment issue` — problema da conta Meta, não das instâncias. Mesmo assim o job segue "Rodando" porque:

- O retry por item (até 3 tentativas) reenfileira antes de todas as instâncias serem marcadas como bloqueadas.
- Itens vão ciclando entre instâncias e acumulam erros individuais, mas `encerrarJobSemDisponibilidade` só dispara quando `bloqueadasRunAtual` cobre todas.
- Como o job ainda tem "instâncias tecnicamente disponíveis" nesse cadastro, ele não para.

## Solução — parar quando todas as instâncias falharem pelo menos 1 vez com 0 sucessos

Alteração pontual em `supabase/functions/envio-meta-massa-tick/index.ts`, dentro de `processarItem`, logo após atualizar `falhasMap`/`bloqueadasRunAtual` e antes de decidir `podeReenfileirar`.

### Regra

Ao terminar o processamento de um item com falha:

1. Considerar o conjunto `todasInstancias = job.instancia_ids`.
2. Considerar `instanciasQueJaFalharam = union(bloqueadasRunAtual, keys(falhasMap))` — ou seja, instâncias que já registraram ≥1 falha neste job.
3. Se `job.enviados === 0` **e** `instanciasQueJaFalharam.length >= todasInstancias.length` (todas já tentaram e falharam), encerrar imediatamente com motivo:
   `"Nenhuma instância conseguiu enviar — todas falharam pelo menos uma vez sem nenhum sucesso"`.

### Comportamento

- Marca o item atual como `erro` (não reenfileira, não faz sentido).
- Chama `encerrarJobSemDisponibilidade(job, motivo)` — que já existe e transita status para `erro`, notifica admin via WhatsApp e limpa `atual_*`.
- Retorna `{ advanced:false, stop:true }` para interromper o loop.

### Por que essa condição

- `enviados === 0` garante que nenhuma instância provou funcionar; se ao menos uma já enviou, o problema não é global e vale continuar tentando.
- Verificar por "já falhou pelo menos uma vez" (não só "bloqueada") acelera a parada: hoje `MAX_FALHAS_CONSECUTIVAS=1` já bloqueia após 1 falha, mas a checagem via união com `falhasMap` cobre casos em que o contador foi resetado antes do bloqueio.
- Como o erro `#131042` retorna imediatamente na API, em poucos segundos todas as 26 instâncias baterão a condição — o job para logo no início ao invés de acumular 47+ falhas.

### Escopo

- **Só** `supabase/functions/envio-meta-massa-tick/index.ts`. Nenhuma migração, nenhuma mudança em UI, webhook, template, cron ou pool.
- Notificação de encerramento reaproveita `notificarConclusao(..., 'erro', motivo)` que `encerrarJobSemDisponibilidade` já dispara.

### Verificação após implementar

- Rodar novo envio de teste com template ainda bloqueado por billing → job deve parar em segundos com status `erro` e motivo visível em `status_motivo`, sem acumular dezenas de falhas.
- Envios normais (ao menos 1 aceito) continuam se comportando como hoje — a guarda `enviados === 0` protege esses casos.
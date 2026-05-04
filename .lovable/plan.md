## Diagnóstico

O badge mostra "0/100 conectados" mesmo havendo chips ativos. Causa raiz identificada em `src/pages/Acionamento.tsx`:

- `connectedCount` (linha 491) conta apenas instâncias com `connectionStatus[i.id] === 'connected'`.
- `connectionStatus` só é populado quando `checkInstanceConnections()` roda.
- Por economia de custo, a verificação automática ao montar a página foi removida (comentário linhas 481-484). Hoje só roda em dois cenários:
  1. Logo após uma nova conexão via QR (linha 1528)
  2. Clique manual no botão "Verificar conexões" (linha 1870)

Resultado: ao abrir o diálogo "Configurações WhatsApp → Instâncias UAZAPI", nenhuma verificação foi disparada, então o status fica em `undefined` para todas as 100 instâncias e o badge mostra `0/100`. Os números/instâncias **estão lá no banco** — apenas o status visual não foi consultado.

Confirma com o screenshot enviado: badge verde "0/100 conectados" com 100 instâncias listadas.

## Correção proposta

**1 alteração mínima em `src/pages/Acionamento.tsx`:**

Adicionar um `useEffect` que dispara `checkInstanceConnections(instances)` automaticamente quando `configDialogOpen` passa de `false` para `true`, **apenas se** ainda não há nenhum status carregado (evita re-verificar a cada abertura do diálogo). Como o `checkUazapiConnection` já tem cache de 5 min em `sessionStorage` (`src/lib/uazapiConnectionCache.ts`), reaberturas seguidas não geram custo extra.

```ts
useEffect(() => {
  if (!configDialogOpen) return;
  if (instances.length === 0) return;
  // Só verifica se ainda não temos nenhum status (cache vazio nesta sessão)
  const jaTemAlgumStatus = instances.some(i => connectionStatus[i.id]);
  if (!jaTemAlgumStatus) checkInstanceConnections(instances);
}, [configDialogOpen, instances, connectionStatus, checkInstanceConnections]);
```

## Custo

- Primeira abertura por sessão: 1 chamada `test-uazapi-connection` por instância ativa (~100), depois cacheada por 5 min.
- Reaberturas dentro de 5 min: **0 chamadas** (cache).
- Aumento mensal estimado: < US$ 0,10 (respeita a regra "Cloud Cost Awareness").

## Fora de escopo

- Não tocar em `checkInstanceConnections`, `connectedCount` ou no badge — a lógica está correta, só falta dispará-la.
- Não restaurar a verificação automática ao montar a página (manter economia).

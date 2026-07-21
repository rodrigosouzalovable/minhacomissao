## Causa raiz confirmada

A tabela `meta_whatsapp_contato_etiquetas` já tem **1.158 vínculos** — acima do limite padrão de 1000 linhas do PostgREST.

Em `src/pages/InboxMeta.tsx`, a função `fetchContatoEtiquetas` faz:

```ts
supabase.from('meta_whatsapp_contato_etiquetas')
  .select('contato_id, etiqueta_id, origem');
```

Sem `range()`, sem ordenação e sem paginação. Como resultado:

- Só voltam **1000 vínculos** de 1158. Cerca de 158 conversas perdem suas etiquetas aleatoriamente (a ordem que o Postgres devolve não é estável).
- Toda vez que **qualquer** evento realtime chega na tabela (`INSERT/UPDATE/DELETE`), o handler chama `fetchContatoEtiquetas()` de novo, que sobrescreve o state inteiro com a versão truncada. É por isso que os cadeados/etiquetas "somem sozinhos" durante o uso e "voltam" quando a página é recarregada em outra ordem.

O crescimento contínuo da tabela (auto-etiquetagem no webhook + envios) só piora o quadro.

## Correção proposta

Todas as mudanças ficam confinadas a `src/pages/InboxMeta.tsx` — sem tocar em RLS, edge functions, ou schema.

1. **Paginar `fetchContatoEtiquetas`**: buscar em blocos de 1000 (`range(0,999)`, `range(1000,1999)`, …) e concatenar até o bloco voltar vazio. Ordenar por `contato_id` para que a paginação seja estável. Só depois disso montar `map` e `bloq` e chamar os dois `setState` juntos, para nunca ficar num estado parcial.

2. **Aplicar realtime incrementalmente** em vez de refazer o fetch inteiro. O canal já entrega `payload.eventType`, `payload.new`, `payload.old`; passamos a atualizar apenas o `contato_id` afetado no state:
   - `INSERT` → adiciona `etiqueta_id` ao array do contato e, se `origem === 'auto_atendente'`, ao set de bloqueadas.
   - `DELETE` → remove das duas estruturas.
   - `UPDATE` → recalcula só a origem (só afeta `etiquetasBloqueadas`).

   Isso elimina o "flash" onde o state é zerado e depois preenchido, que era a janela em que o usuário via as etiquetas sumindo.

3. **Fallback de segurança**: manter um refetch completo apenas quando a página volta a ficar visível (evento `visibilitychange`), reaproveitando o listener que já existe. Assim, se um evento realtime for perdido durante um sleep de aba, a lista se reconstrói sozinha — mas nunca durante uso ativo.

4. **Mesmo tratamento** para o carregamento inicial: enquanto a paginação estiver em andamento, não substituir o state anterior; só chamar `setContatoEtiquetas`/`setEtiquetasBloqueadas` uma vez com o resultado final consolidado.

Nenhuma outra parte do fluxo (context menu, cadeado, filtros, envio) muda: elas continuam consumindo `contatoEtiquetas[contato.id]` e `etiquetasBloqueadas[contato.id]` como hoje.

## Verificação

- Após a correção, abrir o Inbox Meta e conferir no console que `Object.values(contatoEtiquetas).flat().length` ≥ 1158.
- Adicionar/remover uma etiqueta em uma conversa: apenas aquela conversa deve mudar; nenhuma outra pode "piscar" perdendo etiquetas.
- Deixar a página aberta por alguns minutos com tráfego real — as etiquetas não devem mais desaparecer sozinhas.


## Diagnóstico

O loop atual em `handleBulkDeleteImportacoes` chama `delete_importacao_em_lotes` **sequencialmente** para cada uma das 14 planilhas. Cada chamada dessa RPC processa devedores em lotes internos e pode levar de 10s a 60s+ por planilha (principalmente as grandes, com milhares de devedores). Resultado: 14 planilhas × ~30s = potencialmente 5-10 minutos só esperando, sem nenhum feedback de progresso.

Além disso, a chamada RPC PostgREST tem timeout padrão de ~60s — se uma planilha tiver dezenas de milhares de devedores, a RPC pode estourar timeout silenciosamente, e o loop continua na próxima sem o usuário saber.

## Plano

### 1. Adicionar progresso visível
No botão e no banner de "X planilha(s) selecionada(s)", mostrar `Excluindo X de 14...` em tempo real conforme cada RPC termina, em vez de só "Excluindo...".

### 2. Tratar erros por planilha sem abortar tudo
- Capturar erro de cada RPC individualmente.
- Coletar lista de planilhas que falharam.
- Ao final, mostrar toast de sucesso com total + toast de erro listando quais falharam (para o usuário tentar de novo só nessas).

### 3. Atualizar lista incrementalmente
Após cada planilha excluída com sucesso, remover ela do estado `importacoes` localmente (em vez de esperar todas terminarem e dar refetch único). Isso dá feedback visual imediato.

### 4. Aumentar resiliência da RPC
A RPC `delete_importacao_em_lotes` já existe e processa em lotes internos. Confirmar via `code--view` que ela está realmente fatiando e não estourando timeout. Se necessário, ajustar o tamanho do lote interno (provavelmente já está OK — só falta feedback no frontend).

### Arquivos a tocar
- `src/pages/ImportarDevedores.tsx` — refatorar `handleBulkDeleteImportacoes` para:
  - Estado `bulkProgress: { current, total, failed: string[] }`.
  - Loop sequencial com try/catch por iteração.
  - Atualização incremental de `importacoes` e `selectedImportacoes`.
  - Botão mostra `Excluindo {current}/{total}...`.

### Não vou tocar
- A função RPC em si (a menos que a inspeção mostre problema real).
- Lógica de seleção/checkbox (já funciona).

### Resultado esperado
- Usuário vê "Excluindo 3/14..." atualizando em tempo real.
- Planilhas somem da lista uma a uma conforme excluídas.
- Se 2 falharem, recebe toast "12 excluídas, 2 falharam: [nomes]" — pode reselecionar e tentar novamente.
- Sem mais sensação de "travou".

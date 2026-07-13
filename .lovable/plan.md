## Diagnóstico

O banco confirma: `envio_meta_job_item` do job `198efe01…` tem **52 registros com status='enviado'** e 341 pendentes. O contador do card (52/393) vem do próprio `envio_meta_job.enviados`, mas a lista *"Enviados (6)"* vem de `itensByJob` no contexto, que só é atualizada:

1. Na primeira abertura (via `ensureItensLoaded`), ou
2. Quando um evento Realtime de `envio_meta_job_item` chega.

O Realtime de `envio_meta_job_item` não está publicando as mudanças (a tabela não faz parte da publication `supabase_realtime`), então após a carga inicial os 6 primeiros ficaram em cache e nunca foram atualizados. O botão **Atualizar** hoje só chama `refreshStatus()` (recarrega a lista de jobs), sem recarregar os itens.

## Correção

### 1. Recarregar itens sempre que o diálogo abre e no botão "Atualizar"

`src/components/meta/CampanhaDetalheDialog.tsx`
- Expor `carregarItens`/`carregarLogs` no contexto (já existem internamente) via um método público `recarregarItensJob(jobId)`.
- `useEffect` que já chama `ensureItensLoaded` passa a chamar `recarregarItensJob` (força refetch, não só primeira vez).
- Botão **Atualizar** dispara `recarregarItensJob(job.id)` além de `refreshStatus()`.
- Adicionar polling leve: a cada 8 s, enquanto o diálogo está aberto e o job está `rodando`/`pausado`, refaz `recarregarItensJob`. Para quando o diálogo fecha ou o job finaliza. (Evita depender de Realtime.)

### 2. Baixar Excel dos números enviados

- Adicionar botão **"Baixar Excel"** ao lado do **Copiar** no bloco *"Enviados"* do diálogo.
- Usa `xlsx` (`writeFileXLSX`), já presente no projeto (`src/lib/exportExcel.ts`).
- Colunas: `Telefone`, `Instância`, `Enviado em` (formato pt-BR), `Status entrega` (aceito/entregue/lida/falhou), `Erro entrega` quando houver.
- Nome do arquivo: `enviados_<nome_campanha|template>_<AAAA-MM-DD_HH-mm>.xlsx`.
- Mesmo botão de download também aparece no bloco **Erros** (útil para reenvio), gerando planilha `erros_<...>.xlsx` com `Telefone`, `Instância`, `Erro`.

### 3. Realtime da lista de itens (defesa em profundidade)

Migração leve para publicar `envio_meta_job_item` no canal Realtime:

```sql
ALTER TABLE public.envio_meta_job_item REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.envio_meta_job_item;
```

Assim, mesmo sem polling, a lista sobe em tempo real quando novos envios são gravados.

## Escopo de arquivos

- `src/contexts/EnvioMetaSendingContext.tsx` — expor `recarregarItensJob` (thin wrapper de `carregarItens` + `carregarLogs`).
- `src/components/meta/CampanhaDetalheDialog.tsx` — usar refetch no abrir/atualizar, polling 8 s, botão "Baixar Excel" para enviados e erros.
- Nova migração adicionando `envio_meta_job_item` ao `supabase_realtime`.

## Verificação após deploy

1. Abrir o diálogo da campanha em execução: deve carregar imediatamente os 52 números.
2. Aguardar novos envios: a lista deve subir sozinha (Realtime) ou no máximo em 8 s (polling).
3. Clicar **Baixar Excel** → planilha com todos os enviados abre no Excel.
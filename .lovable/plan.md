## Diagnóstico

A planilha foi importada com sucesso (snapshot ativo no banco com **113.176 contratos, 82.297 CPFs únicos, R$ 111.850.277,62**). Os KPIs aparecem zerados porque o hook `useCarteira` está **baixando linha-por-linha as 113 mil linhas para o navegador** (pagination de 1000 em 1000) — no momento do screenshot a chamada estava no offset 36.000 ainda, então `carteira.data` era `undefined` e o componente exibia 0.

Mesmo se terminasse, isso recomeça do zero a cada `refetchInterval` (60 s) e a cada foco da janela. Não é viável puxar a carteira inteira para o cliente.

## Solução

Mover a agregação para o servidor via RPC `comite_carteira_nm_agregar`, que devolve **um único JSON pequeno** com tudo que o painel precisa.

### 1) Migration — função SQL agregadora

`public.comite_carteira_nm_agregar()` (SECURITY DEFINER, só admin via `is_admin_user(auth.uid())`):
- Lê o snapshot ativo (`ativo=true`, mais recente).
- Em **uma única query** sobre `comite_carteira_nm_item` agrega:
  - Totais globais: `total_contratos`, `total_cpfs_unicos`, `total_risco`.
  - Por `faixa`: `qtd`, `cpfs_unicos`, `risco`.
  - Por `credor_tipo`: `qtd`, `cpfs_unicos`, `risco`.
  - Matriz `faixa × credor_tipo`: `qtd`, `cpfs_unicos`, `risco`.
- Retorna `jsonb` com `{ snapshot: {...}, por_faixa: {...}, por_tipo: {...}, matriz: {...}, totais: {...} }`.
- Se não houver snapshot ativo → retorna `{ snapshot: null, ... zeros ... }`.

GRANT EXECUTE para `authenticated`.

### 2) `src/hooks/useComiteNovoMundo.ts`

Reescrever `useCarteira` para:
- Chamar `supabase.rpc('comite_carteira_nm_agregar')` (1 request, payload pequeno).
- Reconstruir os mesmos shapes que o resto da página já consome (`porFaixa`, `porTipo`, `matriz`, `totalContratos`, `totalCpfsUnicos`, `totalRisco`, `totalValor`, `totalValorAtualizado`, `totalQtd`, `snapshot`).
- Remover o `Set<string> cpfs` (não cabe enviar 82k CPFs do servidor toda vez). `useAcordosNovoMundo(mesAno, carteira.data?.cpfs)` passa a receber `undefined` — vou ajustar para que, quando `cpfs` for `undefined`, ele continue funcionando como hoje (filtro de acordos por Novo Mundo sem cruzamento por CPF, já é o comportamento atual quando carteira está vazia).
- Manter `refetchInterval` e realtime, agora baratíssimos.

### 3) Sem alterações em UI

`ComiteNovoMundo.tsx`, `BreakdownFaixasDialog.tsx` e `ImportarCarteiraNMDialog.tsx` continuam iguais — leem os mesmos campos.

## Arquivos

```text
supabase/migrations/<new>.sql        (novo — função agregadora + grant)
src/hooks/useComiteNovoMundo.ts      (reescrever useCarteira p/ usar RPC)
```

## O que NÃO entra

- Não mexe nas tabelas `comite_carteira_nm_snapshot` / `comite_carteira_nm_item`, nem nos dados já importados (a planilha continua válida).
- Não muda regras de faixa, funil, NN/Colchão ou metas.

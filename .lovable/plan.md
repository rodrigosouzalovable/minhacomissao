## Problema

O batimento reportou 35.053 CPFs "ausentes" de 41.268, mas o CPF `99997231104` (último da planilha) está presente no portal. A causa é o limite de linhas do PostgREST:

- Cada CPF tem várias linhas em `devedores` (parcelas). O CPF testado tem **24 linhas**.
- O batimento consulta 500 CPFs por lote via `.in('cpf', [...])` em `devedores` e `acordos_devedor`.
- 500 CPFs × ~10 parcelas em média = milhares de linhas, mas o PostgREST devolve **no máximo 1000 linhas por request** (default do Supabase).
- Os CPFs cujas linhas caíram além das primeiras 1000 do lote nunca entraram no `Set` de presentes → foram marcados como ausentes.

Ou seja, o resultado atual é falso-negativo em massa.

## Correção

Ajustar `src/components/BatimentoCpfsPortalCard.tsx` para paginar cada lote até esgotar as linhas, e reduzir o tamanho do lote para dar margem:

1. Reduzir `BATCH` de 500 → **200 CPFs** por lote (evita bater no limite em quase todos os casos).
2. Envolver a consulta em `devedores` e em `acordos_devedor` num loop de paginação com `.range(from, from + 999)`, repetindo enquanto `data.length === 1000`. Como só precisamos saber *quais* CPFs aparecem, basta `.select('cpf')` / `.select('devedor_cpf')` sem outros campos — reduz payload.
3. Assim que um CPF do lote entra no `Set presentes`, ele fica marcado e o restante das páginas do mesmo lote continua alimentando o mesmo `Set`.
4. Manter o mesmo filtro `.eq('ativo', true)` em `devedores`. Em `acordos_devedor` continuar sem filtro (uma parcela de acordo já indica presença no portal).
5. Ajustar a mensagem de progresso para "Verificando lote X/Y (página N)…" para o usuário perceber quando um lote tem múltiplas páginas.

Sem alterações de schema, RLS, edge function, portal ou fluxo de importação. Apenas o componente client-side é modificado.

## Verificação após o fix

Rodar novamente com a mesma planilha (41.268 CPFs) e conferir que:
- O CPF `99997231104` **não** aparece na lista de ausentes.
- O total de ausentes cai drasticamente (o portal claramente tem esses CPFs).

## Detalhes técnicos

Trecho central do novo loop por lote:

```ts
async function coletarCpfsPresentes(
  tabela: 'devedores' | 'acordos_devedor',
  coluna: 'cpf' | 'devedor_cpf',
  lote: string[],
  onPage: (n: number) => void,
  filtroAtivo: boolean,
): Promise<Set<string>> {
  const encontrados = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  let pagina = 0;
  while (true) {
    pagina++;
    onPage(pagina);
    let q = supabase.from(tabela).select(coluna).in(coluna, lote).range(from, from + PAGE - 1);
    if (filtroAtivo) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data ?? []) encontrados.add(String((r as any)[coluna]));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return encontrados;
}
```

Combina-se em um `Set presentes` global; ao final, `ausentes = cpfs.filter(c => !presentes.has(c))`.
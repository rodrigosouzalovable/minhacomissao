
# Corrigir Contratos Vazios na Ficha do Cliente

## Problema
A query de contratos na ficha do cliente busca **todos** os devedores ativos da tabela (318.040 registros), mas o banco retorna no maximo 1.000 linhas por consulta. O filtro por CPF e feito no frontend, entao quando os registros do cliente nao estao entre os primeiros 1.000, a lista fica vazia.

## Solucao
Filtrar diretamente no banco por CPF(s) ao inves de buscar todos e filtrar no frontend.

## Detalhes Tecnicos

**Arquivo:** `src/pages/DevedorDetalhe.tsx` (linhas 138-144)

Codigo atual (problematico):
```typescript
const { data: ctrs } = await supabase
  .from('devedores')
  .select('...')
  .eq('ativo', true)
  .order('criado_em', { ascending: false });
if (ctrs) setContratos(ctrs.filter(c => allCpfs.includes(c.cpf.replace(/\D/g, ''))));
```

Codigo corrigido:
```typescript
const { data: ctrs } = await supabase
  .from('devedores')
  .select('...')
  .eq('ativo', true)
  .in('cpf', allCpfs)
  .order('data_vencimento', { ascending: true });
if (ctrs) setContratos(ctrs as Devedor[]);
```

A mudanca e simples:
- Adicionar `.in('cpf', allCpfs)` para filtrar no banco diretamente pelo(s) CPF(s) do cliente (ou grupo empresarial)
- Remover o filtro no frontend que era desnecessario
- Ordenar por `data_vencimento` ascendente conforme a politica de ordenacao do sistema (dividas mais antigas primeiro)

Nenhuma alteracao no banco de dados e necessaria.

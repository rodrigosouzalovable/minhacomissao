## Problema identificado

O cliente JOAO VICTOR FERNANDES MOREIRA (acordo `da2f6af5...`) tem a Parcela 1 corretamente marcada como **paga** no banco de dados (`status='pago'`, `data_paga=2026-04-20`), mas aparece na aba **Negociados** em vez de **Pagos**.

## Causa raiz

Em `src/pages/Acordos.tsx` (linha 691), a query que carrega os IDs dos acordos com parcelas pagas é:

```ts
supabase.from('pagamentos').select('acordo_id').eq('status', 'pago')
```

O Supabase aplica um **limite padrão de 1.000 linhas por query**. Hoje existem **1.304 pagamentos com status `pago`** no banco — ou seja, **304 registros estão sendo silenciosamente cortados**. O acordo desse cliente é um dos cortados, então o `Set` `acordosComPagamentosPagos` não o contém, e a regra de classificação manda para "Negociados".

O mesmo bug afeta:
- Aba **Vencidos** (query de `status='pendente'` com `data_prevista < hoje` na linha 702) — também pode estourar 1.000 linhas conforme o sistema cresce.
- Cálculo de **Próximas ao Vencimento**.
- Qualquer outra contagem agregada baseada nessas mesmas queries.

Esse problema vai piorar conforme mais pagamentos forem registrados.

## Correção proposta

Substituir as queries que retornam listas grandes de `pagamentos` por **agregações no servidor**, evitando trafegar milhares de linhas e contornando o limite de 1.000:

### 1. Criar uma função RPC no banco (`get_acordo_status_flags`)

Retorna, **para os acordos do usuário logado** (respeitando RLS / acordos compartilhados), três conjuntos:

```sql
create or replace function public.get_acordo_status_flags(p_acordo_ids uuid[])
returns table (
  acordo_id uuid,
  tem_pago boolean,
  tem_vencida boolean,
  data_vencida_mais_antiga date,
  proxima_vencimento date
)
language sql stable security invoker
as $$
  select
    a.id as acordo_id,
    bool_or(p.status = 'pago') as tem_pago,
    bool_or(p.status = 'pendente' and p.data_prevista < current_date) as tem_vencida,
    min(p.data_prevista) filter (where p.status = 'pendente' and p.data_prevista < current_date) as data_vencida_mais_antiga,
    min(p.data_prevista) filter (where p.status = 'pendente' and p.data_prevista >= current_date) as proxima_vencimento
  from unnest(p_acordo_ids) as a(id)
  left join pagamentos p on p.acordo_id = a.id
  group by a.id
$$;
```

Isso devolve no máximo 1 linha por acordo (centenas, não milhares) e roda totalmente no Postgres.

### 2. Refatorar `src/pages/Acordos.tsx`

- Após carregar `todosAcordos`, chamar `supabase.rpc('get_acordo_status_flags', { p_acordo_ids: ids })`.
- Montar `acordosComPagamentosPagos`, `acordosComParcelasVencidas`, `parcelasVencidasMap` e `proximasVencimentoMap` a partir do retorno único da RPC.
- Remover as duas queries diretas em `pagamentos` (linhas ~691 e ~702) que sofrem do limite de 1.000.

### 3. Validação

- Recarregar a página `/acordos` e confirmar que JOAO VICTOR aparece na aba **Pagos** e some de **Negociados**.
- Verificar que as contagens de Vencidos / Próximas ao Vencimento continuam corretas.
- Conferir que nenhum acordo desaparece das abas.

## Arquivos afetados

- **Migração SQL**: criar função `public.get_acordo_status_flags`.
- **`src/pages/Acordos.tsx`**: substituir as duas queries de `pagamentos` pela chamada RPC e ajustar a montagem dos `Set`/`Map`.

## Impacto

- ✅ Corrige a classificação errada em todas as abas (Pagos, Negociados, Vencidos, Próximas).
- ✅ Reduz drasticamente o volume de dados trafegado (1.300+ linhas → ~N acordos).
- ✅ Solução à prova de crescimento — não quebra mais ao passar de 1.000 pagamentos.
- ⚠️ Sem impacto em custo do Lovable Cloud (apenas troca queries por uma RPC mais leve).
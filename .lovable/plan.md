# Corrigir "Resultado de meses anteriores" no Dashboard

## Problema encontrado
O card busca primeiro a lista de acordos do usuário e depois soma as parcelas pagas no mês. O banco devolve no máximo 1.000 acordos por consulta. Um operador já tem 1.545 acordos, então os mais antigos ficam de fora e os pagamentos deles não entram na soma. O valor de setembro sai menor que o real. Esse card também calcula de um jeito diferente do ranking e das outras telas de recebimento, por isso os números não batem.

## O que vou fazer
1. Antes de mudar, comparar no banco o total de setembro do seu usuário calculado pelo card com o total do ranking mensal, para confirmar a diferença exata.
2. Fazer "Meu resultado" usar o mesmo cálculo de recebimentos do ranking mensal: Novo Mundo, UME e Odres Cred separados, contando pela data efetiva de pagamento e pelo responsável do acordo. Assim o valor fica igual às outras telas.
3. Se esse cálculo não estiver liberado para funcionários, trocar a busca atual por uma busca paginada (sem limite de 1.000) como alternativa, com os mesmos critérios.
4. Conferir que setembro mostra o valor exato e que a quantidade de parcelas e o ticket médio continuam corretos.

## Detalhes técnicos
- Arquivo: `src/components/HistoricoMesesCard.tsx`.
- Causa: `supabase.from('acordos').select('id, empresa').eq('user_id', ...)` sem paginação (limite de 1.000 linhas).
- Preferência: usar a linha do próprio usuário em `ranking_mensal_por_credor_v2(p_mes_ano)`, a fonte versionada que as telas de recebimento já usam. Contagem de parcelas: consulta `count` separada, se o RPC não trouxer.
- Nenhuma rotina nova nem consulta periódica, então o custo do Lovable Cloud não aumenta.

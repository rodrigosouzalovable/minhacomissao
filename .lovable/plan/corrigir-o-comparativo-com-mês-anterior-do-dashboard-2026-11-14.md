# Corrigir o "Comparativo com Mês Anterior" do Dashboard

## O que está errado
Conferi a imagem com os dados reais (1 a 14 de cada mês):

| Indicador | Mostra hoje | Correto |
|---|---|---|
| Acordos criados (mês atual) | 1000 | **1.135** |
| Valor dos acordos (mês atual) | R$ 1.754.903,75 | **R$ 1.953.363,59** |
| Acordos criados (mês anterior) | 478 | 478 (certo) |
| Valor dos acordos (mês anterior) | R$ 730.989,50 | certo |
| Pagamentos recebidos | 326 / 710 | certos |
| Valor recebido | R$ 72.860,02 / R$ 115.734,81 | certos |

Causa: a busca dos acordos do mês para em 1.000 registros. Como novembro passou de 1.000 acordos, o resto ficou de fora. Com isso o crescimento real é **+137,4%** em acordos e **+167,2%** em valor (e não +109,2% / +140,1%).

## O que vou fazer
- Fazer o quadro contar e somar todos os registros do período, sem o limite de 1.000, para todos os perfis (admin e funcionários, cada um vendo só o que já pode ver).
- Os pagamentos usarão a mesma correção, para não travar quando passarem de 1.000.
- Não muda nenhuma regra, só a contagem.

## Detalhes técnicos
- `src/pages/Dashboard.tsx`: no ramo não-admin, trocar os `select` diretos por busca paginada (`range` em blocos de 1.000) para acordos e pagamentos, somando e contando no cliente; RLS continua valendo.
- Conferir se o ramo admin (`comparativo_mensal_global`) é o usado pelo seu login; se o número 1000 vier dele, o RPC já conta direto no banco e só o ramo de funcionário precisa da correção.
- Sem novo polling ou custo adicional relevante (mesma consulta, só paginada).

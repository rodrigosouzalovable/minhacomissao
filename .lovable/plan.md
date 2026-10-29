# Duas correções: resultado de setembro e caixa PADRÃO no Inbox Meta

## 1. Resultado de meses anteriores (Dashboard)

### Problema encontrado
O card busca primeiro a lista de acordos do usuário e depois soma as parcelas pagas no mês. O banco devolve no máximo 1.000 acordos por consulta, e um operador já tem 1.545. Os acordos que passam desse limite ficam de fora da soma, então setembro aparece com valor menor. O card também calcula de um jeito diferente do ranking e das outras telas de recebimento.

### O que vou fazer
1. Comparar no banco o total de setembro calculado pelo card com o do ranking mensal, para confirmar a diferença exata.
2. Fazer "Meu resultado" usar o mesmo cálculo do ranking mensal: Novo Mundo, UME e Odres Cred separados, pela data efetiva de pagamento e pelo responsável do acordo.
3. Se esse cálculo não estiver liberado para funcionários, trocar por uma busca paginada, sem o limite de 1.000.
4. Conferir que setembro mostra o valor exato e que as parcelas pagas e o ticket médio continuam corretos.

## 2. Caixa PADRÃO não aparece primeiro no Inbox Meta

### Causa provável (vou confirmar antes de corrigir)
A caixa PADRÃO só aparece depois que o sistema confirma que você é admin. Na correção da lentidão, coloquei um limite de 10 segundos nessa confirmação. Se o banco demora ou falha, o sistema passa a te tratar como funcionário até a página ser recarregada. Funcionário sem permissão na PADRÃO não vê essa caixa, e o botão de atualizar refaz só a lista de caixas, sem confirmar de novo se você é admin. Por isso a PADRÃO continua escondida.

### O que vou fazer
1. Confirmar no banco seu cargo e sua permissão na PADRÃO, para validar a causa.
2. Se a confirmação do cargo falhar ou demorar, tentar de novo antes de tratar alguém como funcionário. Assim um admin não perde a PADRÃO por causa de uma lentidão momentânea.
3. Fazer o botão de atualizar confirmar de novo o cargo e a permissão da PADRÃO, além da lista de caixas.
4. Mostrar sempre a PADRÃO como primeira caixa e abrir nela ao entrar no Inbox, para quem tem acesso. As outras caixas vêm depois.
5. Abrir o Inbox com seu acesso e verificar que a PADRÃO aparece primeiro.

## Detalhes técnicos
- `src/components/HistoricoMesesCard.tsx`: `acordos` sem paginação. Preferir a linha do próprio usuário em `ranking_mensal_por_credor_v2(p_mes_ano)`.
- `src/hooks/useUserRole.tsx`: em erro/timeout, fazer novas tentativas com espera crescente em vez de fixar `funcionario`, mantendo `loading` até a resposta. Expor `refetch`.
- `src/pages/InboxMeta.tsx`: `atualizarCaixas` também chama o refetch do cargo. Garantir que a PADRÃO (`currentFolderId = null`) é renderizada antes das demais e selecionada na abertura quando `podeVerPadrao`.
- Nenhuma rotina nova nem consulta periódica, então o custo do Lovable Cloud não aumenta.

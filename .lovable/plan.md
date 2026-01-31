
## Objetivo
Fazer a página **Acordos da Equipe** voltar a exibir acordos e calcular **Total Parcelas Pagas / Comissão** corretamente quando um período é selecionado (e também sem período), eliminando o cenário atual onde tudo fica **zerado** e “Nenhum acordo encontrado” mesmo existindo pagamentos no banco.

---

## Diagnóstico (por que está acontecendo)
Pelos sintomas na tela (membros=6, mas total de acordos=0, total parcelas pagas=R$0,00) e pelo código atual, o problema mais provável é:

1. A lista `pagamentosEquipe` está ficando **vazia** no front.
2. Quando você seleciona datas, o filtro `matchesDate = acordosComPagamentoNoPeriodo.has(acordo.id)` depende de `pagamentosFiltradosPorPeriodo`.
3. Se `pagamentosEquipe` não carregou, então `pagamentosFiltradosPorPeriodo` fica vazio → `acordosComPagamentoNoPeriodo` fica vazio → **todos os acordos são filtrados** e os cards ficam zerados.

A causa raiz mais comum disso nesse tipo de código é que o fetch de pagamentos está usando:
- `.in('acordo_id', acordoIds)`  
e `acordoIds` pode gerar uma URL muito grande (muitos UUIDs na query string) e a requisição falha (400/414).  
Hoje, se essa requisição falhar, o código **não mostra erro pro usuário** e apenas não popula `pagamentosEquipe`, levando ao “0 em tudo”.

Observação importante: no banco existem pagamentos pagos em 01/2026 (portanto, a UI deveria mostrar dados no seu filtro). Logo o problema é realmente “carregamento/consulta” no front, não “ausência de dados”.

---

## Estratégia de correção
### 1) Trocar o jeito de buscar pagamentos pagos (evitar `.in` com muitos IDs)
Em vez de filtrar `pagamentos` por uma lista enorme de `acordoIds`, vamos filtrar por `user_id` dos funcionários via join com `acordos`:

- Buscar pagamentos pagos com `pagamentos -> acordos (inner) -> user_id`
- Filtrar por `funcionarioIds` (que tende a ser bem menor e estável)
- Continuar retornando apenas os campos necessários: `comissao_parcela`, `valor_parcela`, `acordo_id`, `data_paga`, `numero_parcela`

Isso reduz drasticamente o tamanho da URL e evita a falha silenciosa.

### 2) Aplicar a mesma correção na consulta de “quebra de acordo”
Hoje ela também usa `.in('acordo_id', acordoIds)`. Vamos ajustar para o mesmo padrão (join por `acordos.user_id`), evitando outra possível falha.

### 3) Melhorar o tratamento de erro (para não “falhar silenciosamente”)
Se a consulta de pagamentos falhar:
- logar o erro com detalhes
- mostrar `toast` “Erro ao carregar pagamentos”
- manter a tela utilizável (e não deixar parecer que é “zero no banco”)

### 4) (Opcional, mas recomendado) Garantir que não há corte de 1000 linhas
Se no futuro houver mais de 1000 pagamentos, a plataforma pode limitar resultados por padrão. Vamos:
- definir `.range(0, 9999)` (ou paginação simples) para garantir que os totais reflitam tudo.

---

## Mudanças planejadas no código
### Arquivo: `src/pages/EquipeAcordos.tsx`

#### A) Substituir o bloco “Buscar pagamentos pagos dos acordos da equipe”
**Antes (atual):**
- pega `acordoIds` de todos os acordos
- faz `pagamentos.in('acordo_id', acordoIds).eq('status','pago')`

**Depois (novo):**
- faz `pagamentos.select(..., acordos!inner(user_id))`
- filtra por `.in('acordos.user_id', funcionarioIds)`
- `.eq('status','pago')`
- (opcional) `.range(0, 9999)`

E então normaliza o retorno para manter o estado `pagamentosEquipe` no mesmo formato esperado.

#### B) Substituir o bloco “Buscar IDs de acordos com QUEBRA DE ACORDO”
Mesma ideia: query em `pagamentos` pendentes com join em `acordos`, filtrando por `acordos.user_id IN funcionarioIds`.

#### C) Toast e logs para falhas
Adicionar `toast({ variant: 'destructive', ... })` quando houver erro em pagamentos/quebra, e também `console.error` com o erro retornado.

---

## Critérios de aceite (como você vai validar)
1. Abrir **/equipe/acordos** sem selecionar data:
   - “Total de Acordos” deve ser > 0 (se existirem acordos no banco para essa equipe)
   - “Total Parcelas Pagas” deve refletir a soma dos pagos (não pode ficar 0 se houver pagos)
2. Selecionar período **01/01/2026 até 31/01/2026**:
   - Deve aparecer uma lista (não “Nenhum acordo encontrado”), já que existem pagamentos pagos nesse intervalo.
   - “Total Parcelas Pagas” deve ficar > 0.
3. Exportar:
   - “Exportar” deve gerar parcelas pagas do período (quando houver).
4. Se houver erro de consulta:
   - Deve aparecer toast explicando o problema (não ficar tudo zerado sem explicação).

---

## Notas técnicas (para manter compatibilidade com o que já foi feito)
- Mantemos a lógica de filtro por string `YYYY-MM-DD` (ela continua válida).
- A correção é focada em **garantir que `pagamentosEquipe` carregue** com consistência.
- Não altera a regra de negócio do filtro (continua sendo por `data_paga`).


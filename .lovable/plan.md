

## Corrigir Lembretes Mostrando Parcelas de Acordos com Pagamentos Já Realizados

### Diagnóstico

Os lembretes de vencidos estão mostrando parcelas pendentes de acordos onde o cliente já pagou parcelas posteriores. Por exemplo, se o cliente pagou parcela 2 mas parcela 3 está pendente e vencida, ela aparece no lembrete — mas se o cliente já pagou parcelas recentes, essas parcelas antigas provavelmente são inconsistências, não cobranças reais.

O problema está no hook `usePaymentReminders.tsx` que busca **todas** as parcelas com `status = 'pendente'`, sem verificar se existem parcelas mais recentes já pagas no mesmo acordo.

### Solução

Adicionar um filtro no hook `usePaymentReminders.tsx` que exclui parcelas pendentes quando o acordo possui parcelas com `numero_parcela` maior já marcadas como pagas. Ou seja: se a parcela 5 está paga, a parcela 3 pendente não deve aparecer como lembrete.

### Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePaymentReminders.tsx` | Filtrar no frontend: após buscar parcelas pendentes, remover as que pertencem a acordos onde uma parcela posterior já foi paga |

### Lógica do filtro

Para cada parcela pendente retornada:
1. Agrupar por `acordo_id`
2. Para cada acordo, verificar se existe alguma parcela com `numero_parcela` maior e `status = 'pago'`
3. Se sim, remover essa parcela pendente dos lembretes

Isso será feito em duas etapas:
- Na query de **pagamentos hoje e 3 dias**: adicionar filtro client-side
- Na query de **parcelas vencidas**: adicionar filtro client-side
- Alternativamente, fazer uma sub-query SQL que exclua parcelas onde existem parcelas posteriores pagas no mesmo acordo

### Abordagem preferida: filtro SQL direto

Adicionar cláusula `AND NOT EXISTS (SELECT 1 FROM pagamentos p2 WHERE p2.acordo_id = pagamentos.acordo_id AND p2.status = 'pago' AND p2.numero_parcela > pagamentos.numero_parcela)` nas três queries de pagamentos.

Isso garante que:
- Parcelas vencidas com parcelas posteriores pagas **não aparecem**
- Parcelas legítimas (próximo vencimento) continuam aparecendo normalmente

### O que NÃO muda
- Lembretes de retornos permanecem iguais
- Lógica de marcar como lido/deslido permanece igual
- Templates e envio de WhatsApp não são afetados


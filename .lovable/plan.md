

## Diagnóstico

**Caso ADAILTON SOUZA BARROS:** Acordo pertence a **Anna Flavia** (funcionária). Parcela 1 vence hoje (17/04/2026), status `pendente`. ✅ Os dados estão corretos no banco.

**Causa raiz:** O hook `usePaymentReminders.tsx` filtra pagamentos por `acordos.user_id IN userIds`, onde `userIds` é montado assim:
- **Funcionário com "Acordos Compartilhados":** vê os próprios + os do admin que concedeu acesso ✅
- **Admin (ex: Rodrigo):** vê APENAS os próprios acordos ❌

Como o Adailton é da Anna, e o Rodrigo (admin) está olhando os lembretes, ele **nunca vê** os acordos da equipe — mesmo tendo acesso global na aba "Acordos da Equipe". Isso afeta TODOS os clientes da equipe, não só o Adailton.

A mesma lógica falha está em 3 queries do hook: `payment-reminders` (hoje/3 dias), `overdue-reminders` (vencidos) e `retorno-reminders`.

## Solução

**Arquivo:** `src/hooks/usePaymentReminders.tsx`

1. Detectar se o usuário é **admin** (via `useUserRole`).
2. Se for admin: **não filtrar por `user_id`** nas 3 queries — buscar TODOS os pagamentos pendentes / parcelas vencidas / retornos do sistema (RLS já permite admin ver tudo).
3. Se for funcionário: manter lógica atual (próprios + admin compartilhado).
4. Aplicar nas 3 queries: `payment-reminders`, `overdue-reminders`, `retorno-reminders`.
5. Incluir `isAdmin` nas `queryKey` para invalidação correta.

```ts
// Pseudo
const { isAdmin } = useUserRole();
const queryFilter = isAdmin
  ? (q) => q                                      // sem filtro
  : (q) => q.in('acordos.user_id', userIds);      // funcionário
```

**Resultado:** Admin passa a ver todos os boletos vencendo hoje + vencidos + retornos da equipe inteira no dialog de lembretes. Anna continua vendo os dela + do admin (sem mudança).

## Custo Lovable Cloud

**Zero impacto.** Mesmas 3 queries, apenas removendo um filtro `IN`. Para admin, a query até fica mais leve (sem `JOIN inner` por user_id).

## Fora de escopo

- Não vou criar paginação extra (volume atual é baixo: parcelas pendentes de hoje/3 dias/vencidas).
- Não vou mexer em `RetornoAlertChecker` nem em outros componentes — só no hook centralizado.




## Lembretes compartilhados para usuários com "Acordos Compartilhados"

### Problema
Quando um funcionário tem "Acordos Compartilhados" ativado, ele vê os acordos do admin, mas os **lembretes de pagamento** (sino) só mostram os lembretes dos acordos próprios. O funcionário precisa ver também os lembretes do admin.

### Solução
Modificar o hook `usePaymentReminders` para, quando o usuário tiver `acordos_compartilhados = true`, buscar também os lembretes dos acordos do admin (`concedido_por`).

### Alterações

**`src/hooks/usePaymentReminders.tsx`**:
1. Importar `supabase` para buscar permissões do usuário
2. Adicionar query para buscar `acordos_compartilhados` e `concedido_por` do `user_permissions`
3. Nas 3 queries de pagamentos (hoje/3dias, vencidos, retornos):
   - Remover o filtro `.eq('acordos.user_id', user.id)` 
   - Substituir por filtro `.in('acordos.user_id', [user.id, adminId])` quando houver compartilhamento
   - Para retornos: `.in('user_id', [user.id, adminId])`
4. Ajustar as query keys para incluir o `adminId` (cache correto)

**`src/components/PaymentReminders.tsx`**:
1. Ao abrir o dialog de envio em lote, buscar instâncias do admin também (quando compartilhado), para que as instâncias do admin fiquem disponíveis para envio

### Resultado
Funcionária com "Acordos Compartilhados" verá todos os lembretes do admin no sino, podendo expandir e visualizar exatamente como o admin vê.


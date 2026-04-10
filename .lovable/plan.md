

## Liberar edição de acordos para Anna Flavia (usuários com Acordos Compartilhados)

### Problema
Atualmente, apenas o **dono do acordo** (`isOwner`) e **administradores** (`isAdmin`) podem editar acordos — marcar como pago, editar datas, enviar boleto, etc. Usuários com a permissão "Acordos Compartilhados" (como Anna Flavia) conseguem **ver** os acordos, mas ficam em modo "Somente Leitura".

### Solução
Modificar a página `AcordoDetalhe.tsx` para tratar usuários com `acordos_compartilhados = true` como tendo permissão de edição nos acordos compartilhados.

### Arquivo: `src/pages/AcordoDetalhe.tsx`

1. **Importar `useUserPermissions`** e buscar `acordosCompartilhados` e `concedidoPor`

2. **Criar variável `canEdit`** que será `true` quando:
   - O usuário é o dono (`isOwner`), OU
   - O usuário é admin (`isAdmin`), OU
   - O usuário tem `acordosCompartilhados === true` E o acordo pertence ao admin que concedeu a permissão (`acordo.user_id === concedidoPor`)

3. **Substituir todas as verificações `(isOwner || isAdmin)`** por `canEdit` (~10 ocorrências):
   - Botões de editar acordo
   - Marcar como pago / desmarcar
   - Editar data de vencimento / pagamento
   - Marcar boleto como enviado
   - Quebrar acordo / excluir

4. **Atualizar o badge "Somente Leitura"** para aparecer apenas quando `!canEdit`

### Resultado
Anna Flavia (e qualquer funcionário com "Acordos Compartilhados" ativo) poderá editar, marcar como pago, enviar boleto — exatamente como o administrador que concedeu a permissão.


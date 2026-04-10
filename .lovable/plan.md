

## Acordos Compartilhados — Plano

### O que será feito
Adicionar um toggle "Acordos Compartilhados" nas permissões do usuário. Quando ativado, o funcionário poderá ver todos os acordos do administrador que concedeu o acesso (usando `concedido_por`), além dos seus próprios. O funcionário também terá acesso a todas as instâncias WhatsApp do admin (reaproveitando a lógica de `concedido_por` já existente).

### Mudanças

**1. Migração — Adicionar coluna `acordos_compartilhados`**
- Adicionar `acordos_compartilhados boolean default false` na tabela `user_permissions`
- Adicionar RLS policy para que usuários com `acordos_compartilhados = true` possam ver os acordos do admin que concedeu acesso (`concedido_por`)

**2. EditPermissionsDialog.tsx — Novo toggle**
- Adicionar estado `acordosCompartilhados` (boolean)
- Adicionar toggle abaixo de "Inbox Compartilhado" com label "Acordos Compartilhados" e descrição "Permite ver todos os acordos e instâncias WhatsApp do seu login"
- Incluir no payload de save
- Quando `acordosCompartilhados` é ativado, também setar `concedido_por` (já é feito quando inbox é ativo — ajustar para setar se qualquer um dos dois estiver ativo)

**3. useUserPermissions.tsx — Expor novo campo**
- Retornar `acordosCompartilhados` do hook

**4. Acordos.tsx — Query compartilhada**
- Quando `acordosCompartilhados` estiver ativo, buscar `concedido_por` das permissões e fazer query adicional dos acordos do admin
- Combinar acordos próprios + acordos do admin, marcando visualmente os do admin

**5. WhatsAppInbox.tsx / AppLayout.tsx — Acesso às instâncias**
- Ajustar a lógica de `fetchInstancias` para também considerar `acordos_compartilhados` (não só `inbox_compartilhado`) ao mostrar instâncias do admin

### Arquivos afetados
- Migração SQL (nova coluna + RLS policy)
- `src/components/EditPermissionsDialog.tsx`
- `src/hooks/useUserPermissions.tsx`
- `src/pages/Acordos.tsx`
- `src/pages/WhatsAppInbox.tsx` (opcional, se inbox_compartilhado já cobre)
- `src/components/layout/AppLayout.tsx` (badge unread)


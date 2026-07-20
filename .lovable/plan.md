## Objetivo
Adicionar um toggle por usuário em Admin > Usuários > Permissões chamado **"Pode marcar parcelas como pago"**. Somente usuários com esse toggle ATIVO poderão marcar/desmarcar parcelas como pagas em qualquer acordo. Admin sempre pode.

## Estado atual (verificado)
- Já existe a coluna `pode_marcar_pago_global` em `user_permissions` e o hook `useUserPermissions` já a expõe como `podeMarcarPagoGlobal`.
- Em `src/pages/AcordoDetalhe.tsx` a lógica atual é:  
  `canMarcarPago = canEdit || podeMarcarPagoGlobal` — ou seja, hoje qualquer dono do próprio acordo pode marcar como pago, mesmo sem a flag. Isso precisa mudar.
- O diálogo `EditPermissionsDialog.tsx` **não** possui esse toggle na UI.

## Mudanças

### 1. UI de permissões (`src/components/EditPermissionsDialog.tsx`)
- Adicionar estado `podeMarcarPago` (default `false`).
- Carregar/salvar a coluna `pode_marcar_pago_global` no `useEffect` e no payload do `saveMutation`.
- Novo bloco Switch: **"Pode marcar parcelas como pago"** com descrição: "Se desativado, o usuário não conseguirá marcar/desmarcar parcelas como pagas. Admin sempre pode."

### 2. Regra de negócio (`src/pages/AcordoDetalhe.tsx`)
- Alterar `canMarcarPago` para exigir a flag explicitamente:  
  `canMarcarPago = isAdmin || (canEdit && podeMarcarPagoGlobal)`
- Nos botões "Marcar como pago" / "Desmarcar" já governados por `canMarcarPago`, exibir mensagem discreta quando o usuário não tem permissão (reaproveitar o bloco existente em `pago && !canMarcarPago`).

### 3. Padrão em outros locais
Verificar rapidamente se há outros pontos que marcam `status: 'pago'` (ex.: `EditarAcordo.tsx`) e aplicar a mesma checagem antes de permitir a ação. Apenas leitura de status permanece livre.

## Fora de escopo
- Não alterar RLS do banco nesta tarefa (a trava é de UI/produto). Se quiser trava server-side depois, adicionamos uma policy no `pagamentos`.
- Sem mudança de schema — a coluna já existe.

## Objetivo

Fazer com que funcionários com **Acordos Compartilhados** ativado vejam exatamente a mesma tela `/equipe/acordos` que o admin vê hoje — listando **todos os acordos lançados no sistema**, de qualquer funcionário, não apenas os do admin que concedeu acesso.

## Situação atual (diagnóstico)

1. **Frontend (`EquipeAcordos.tsx`)**: já existe a lógica `verComoAdmin = isAdmin || acordosCompartilhados`. Quando ligada, o código tenta buscar **todos** os perfis e acordos do sistema. ✅
2. **Sidebar (`AppLayout.tsx`)**: o item "Acordos da Equipe" está marcado como `gestorOnly`. Funcionários comuns não enxergam o link, mesmo com `acordosCompartilhados = true`. ❌
3. **Banco (RLS de `acordos`, `pagamentos`, `profiles`)**: as policies de "Acordos compartilhados" hoje só liberam **os acordos do admin que concedeu** (`get_acordos_compartilhados_admin`). Não liberam os acordos de outros funcionários do sistema. Resultado: mesmo se o frontend pedir, o banco devolve apenas um subconjunto. ❌

Ou seja: a interface está pronta, mas o link some no menu e o banco bloqueia a visão completa.

## O que precisa mudar

### 1. Banco de dados (migration — somente leitura, nada é apagado)

Criar uma função auxiliar e novas policies de **SELECT** para usuários com `acordos_compartilhados = true`:

- `has_acordos_compartilhados(_user_id uuid) returns boolean` — `SECURITY DEFINER`, lê `user_permissions`.
- Nova policy em `public.acordos`: SELECT liberado para qualquer linha quando `has_acordos_compartilhados(auth.uid())` for verdadeiro.
- Nova policy em `public.pagamentos`: SELECT liberado para qualquer linha quando o usuário tem acordos compartilhados.
- Nova policy em `public.profiles`: SELECT liberado para qualquer perfil quando o usuário tem acordos compartilhados (necessário para mostrar o nome do funcionário em cada acordo).

Importante: **somente SELECT**. As policies de UPDATE/DELETE existentes continuam intactas — funcionários compartilhados não ganham poder de editar acordos de terceiros.

### 2. Frontend (`src/components/layout/AppLayout.tsx`)

Ajustar o filtro do menu lateral para que o item **"Acordos da Equipe"** apareça também quando `acordosCompartilhados === true`, não apenas para gestores/admin.

Como `/equipe/acordos` já está em `AVAILABLE_TABS` e é incluído por padrão em `abasPermitidas`, o `PermissionRoute` já permite o acesso. Falta apenas tornar o link visível.

## Garantias

- ✅ **Nenhum dado é apagado nem alterado**. Apenas novas policies de leitura.
- ✅ **WhatsApps e acordos fechados intactos**. Nada toca em instâncias, mensagens, contatos, parcelas pagas ou status.
- ✅ **Funcionários compartilhados continuam sem poder editar/apagar** acordos de outros — só visualizar.
- ✅ **Admin continua com tudo igual**.

## Arquivos afetados

- Migration nova (função + 3 policies de SELECT).
- `src/components/layout/AppLayout.tsx` (1 linha no filtro do menu).

## Próximo passo

Aprovar para eu executar a migration e o ajuste do menu.
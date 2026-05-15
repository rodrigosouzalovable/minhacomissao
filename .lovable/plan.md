## Objetivo

Na aba **Meus Acordos**, qualquer usuário logado passa a ver **todos os acordos do sistema** (próprios + de outros), em modo **somente leitura** para os que não são dele. Comissões, ranking e dashboard continuam pessoais.

## Mudanças

### 1. Backend (RLS na tabela `acordos` e `pagamentos`)

Adicionar política de SELECT global para qualquer usuário autenticado:

- `acordos`: nova policy `"Authenticated users can view all acordos"` — `FOR SELECT TO authenticated USING (true)`.
- `pagamentos`: nova policy equivalente, para que as parcelas dos acordos alheios também carreguem (necessário para o card mostrar status, vencidas, próximas).

As policies existentes de INSERT/UPDATE/DELETE **não mudam** — continuam restritas ao dono ou admin. Isso garante o "somente leitura".

### 2. Frontend — `src/pages/Acordos.tsx`

- Trocar `from('acordos').select('*').eq('user_id', user.id)` por `select('*')` sem o filtro de `user_id`, mantendo a ordenação por `criado_em desc`.
- Remover o bloco de "acordos compartilhados" (vira redundante já que todos veem tudo); a permissão `acordos_compartilhados` continua existindo no banco mas não precisa ser consultada aqui.
- Buscar `profiles (id, nome)` numa única query e juntar em memória para exibir, em cada card, um pequeno selo **"Lançado por: <nome>"** quando `acordo.user_id !== user.id`.
- Bloquear ações de escrita para acordos de outros usuários (não-admin):
  - Botões **Excluir**, **Transferir**, **Marcar como pago**, **Editar parcelas inline**, **Disparar lembrete WhatsApp**, **Cancelar/Quebrar** ficam ocultos ou desabilitados quando `acordo.user_id !== user.id` e o usuário não é admin.
  - Admin mantém acesso total como hoje.
- Manter o link de **Detalhes** funcionando para todos (apenas leitura na página de detalhe também — ver item 3).

### 3. Página de detalhe — `src/pages/AcordoDetalhe.tsx`

Mesma regra: se `acordo.user_id !== user.id` e não-admin, esconder botões de edição/exclusão/marcar pago/enviar WhatsApp; só leitura.

### 4. Dashboard, Comissões e Ranking — sem mudança

- `Dashboard.tsx`, `Comissoes.tsx`, `RankingMensal` continuam filtrando por `user_id` próprio. Como as RLS de SELECT ficam abertas, as queries pessoais permanecem corretas porque elas mesmas filtram por `user_id`.

## Detalhes técnicos

- A migração só adiciona policies; não remove as existentes nem altera colunas, então é não-destrutiva e reversível.
- As queries de `pagamentos` em outras telas (comissões, dashboard) continuam filtradas por `acordos!inner(user_id).eq('acordos.user_id', user.id)`, então não mudam de comportamento.
- Custo Lovable Cloud: aumento marginal — a aba passa a trazer N acordos em vez de N do usuário. Para times pequenos é desprezível; se a tabela crescer muito, podemos paginar depois.

## Fora de escopo

- Não mexer em comissão/ranking/dashboard.
- Não conceder edição cruzada para não-admins.
- Não alterar página de **Equipe / Acordos** (que já tem sua própria lógica de gestor).
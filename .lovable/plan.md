## Objetivo

No sino de "Consultas de CPF" do Inbox Meta Oficial:
1. Admin vê todas as notificações + para qual funcionário cada uma foi atribuída.
2. Cada card ganha botão de copiar CPF ao lado do número.
3. Ao clicar em copiar, o card fica verde na tela do funcionário responsável E na tela do admin, em tempo real.

## Mudanças

### 1. Banco de dados (migração)
- Adicionar coluna `cpf_copiado_em timestamptz` (nullable) em `consulta_cpf_notificacoes`.
- Ajustar RLS:
  - `SELECT`: manter regra atual do funcionário (vê os próprios) **e** adicionar policy permitindo admin ver todos via `has_role(auth.uid(), 'admin')`.
  - `UPDATE`: permitir que o funcionário atribuído marque `lida_em` / `cpf_copiado_em`; admin também pode atualizar (para consistência).
- Garantir GRANT `SELECT, UPDATE` em `authenticated` (já existente, revisar).

### 2. Edge function `notify-cpf-consulta`
- Nenhuma mudança funcional necessária — já grava `assigned_user_id`. Confirmar que continua salvando corretamente.

### 3. Componente `NotificacoesCpfBell.tsx`
- Detectar se o usuário logado é admin (via `useUserRole` / `has_role`).
- **Se admin**: buscar todas as notificações (sem filtro `assigned_user_id`); realtime sem filtro. Mostrar linha extra "Atribuído a: {nome do funcionário}" em cada card. Fazer join/lookup em `profiles` pelo `assigned_user_id` para obter o nome.
- **Se funcionário**: comportamento atual (apenas as suas).
- Adicionar botão `CopyButton` (componente existente) ao lado do CPF, com `preserveText={false}` (copia só dígitos). No `onClick`, além de copiar, disparar `UPDATE consulta_cpf_notificacoes SET cpf_copiado_em = now() WHERE id = ...`.
- Estilo do card quando `cpf_copiado_em IS NOT NULL`: fundo verde (`bg-green-500/10 border-l-2 border-green-500`) sobrescrevendo o azul de "não lida".
- Realtime já reflete o UPDATE em ambos (admin sem filtro; funcionário pelo filtro atual), então admin vê a mudança de cor assim que o funcionário clicar.

### 4. Escopo excluído
- Nenhuma mudança em outros fluxos de notificação, portal público ou permissões.
- Sem novos campos além de `cpf_copiado_em`.

## Detalhes técnicos

- Verde deve ter prioridade visual sobre "não lida" (aplicar condicional na className).
- Para o admin, exibir o nome do funcionário buscando `profiles.nome` (fallback para email/id curto se faltar). Fazer numa query separada por `in('id', userIds)` após carregar as notificações, para evitar problemas de RLS em join.
- Copiar CPF usa o `CopyButton` já existente (`src/components/CopyButton.tsx`) com `value={cpf}`.

# Selecionar quem precisa bater ponto

Hoje o bloqueio de ponto vale para todo usuário que não seja admin nem gestor. A ideia é passar a controlar isso individualmente, dentro das permissões de cada usuário.

## O que muda

1. **Novo campo nas permissões do usuário** (Usuários > Permissões): um botão liga/desliga chamado **"Precisa bater ponto"**, junto dos outros controles do usuário.
   - Padrão para usuários novos e existentes: **desligado** (ninguém é obrigado até você marcar).
2. **Bloqueio do sistema** passa a acontecer só para quem estiver com esse campo ligado. Quem estiver desligado usa o sistema normalmente e não vê a tela de ponto.
3. **Card de ponto no Dashboard** aparece apenas para quem precisa bater ponto.
4. **Alertas no WhatsApp** (09:15 e 18:30) passam a considerar apenas os usuários marcados, evitando cobrar quem não bate ponto.
5. **Painel Controle de Ponto**: o seletor de funcionário e o relatório listam apenas os usuários marcados como obrigados, para o relatório não ficar poluído.
6. Se você desligar o campo de alguém, os registros antigos dessa pessoa continuam salvos e visíveis no relatório.

## Detalhes técnicos

- Migração: `ALTER TABLE public.user_permissions ADD COLUMN bate_ponto boolean NOT NULL DEFAULT false;` (RLS existente já cobre a coluna).
- `src/hooks/useUserPermissions.tsx`: expor `batePonto`.
- `src/components/EditPermissionsDialog.tsx`: novo estado + Switch, carregamento no `useEffect` e no `payload` do save (insert e update).
- `src/components/ponto/PontoGate.tsx`: só bloqueia quando `batePonto === true` (admin/gestor continuam livres); aguarda o carregamento das permissões antes de decidir.
- `src/pages/Dashboard.tsx`: renderizar `PontoCard` apenas quando `batePonto`.
- `supabase/functions/ponto-alertas-diarios/index.ts`: cruzar `profiles` com `user_permissions.bate_ponto = true` (mantendo o respeito a `ponto_jornada_config.ponto_obrigatorio`).
- `src/pages/PontoAdmin.tsx`: filtrar a lista de perfis pelos `user_id` com `bate_ponto = true`.

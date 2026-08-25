# Liberar painel "Conversas por atendente" para todos

Hoje o painel mostra a lista completa só para o admin. Os demais usuários veem apenas a própria linha, porque o filtro está na função do banco que alimenta o painel.

## O que muda

- Todo usuário autenticado passa a ver a lista completa de atendentes (Atendidas / Iniciadas) e o total, nas três abas (Hoje, Semana, Mês) — igual à visão do admin.
- O nome do próprio usuário continua destacado em negrito na lista.
- O número no badge do ícone passa a refletir o total geral do dia para todos (hoje o não-admin vê só o próprio).
- Nada muda em permissões de mensagens, conversas ou etiquetas: continua sendo apenas contagem agregada por atendente, sem expor conteúdo de conversa.

## Detalhes técnicos

- Migration: recriar `public.meta_atendimentos_por_atendente` (SECURITY DEFINER, STABLE) removendo a condição `(has_role(auth.uid(),'admin') OR m.user_id = auth.uid())`, mantendo os demais filtros (`direcao='saida'`, janela de datas, `user_id IS NOT NULL`) e o agrupamento/ordenação atuais.
- `src/components/inbox/meta/AtendimentosBell.tsx`: no cálculo do badge, somar todas as linhas em vez de filtrar por `user_id === user?.id` quando não for admin (remove a dependência de `isAdmin`).

# Painel "Conversas por atendente" só para o admin

## O que muda

- No Inbox Meta Oficial, o ícone de gráfico "Conversas por atendente" deixa de aparecer para funcionários — só o seu login (admin) vê o ícone e o painel.
- Como o painel some para os funcionários, a consulta que alimenta o badge também deixa de rodar no login deles (menos consultas, custo menor).
- Bloqueio real no banco: além de esconder o ícone, a função que devolve os números por atendente passa a responder apenas para admin. Assim ninguém consegue ver os totais por outro caminho.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx` (linha ~1577): renderizar `<AtendimentosBell />` apenas quando `isAdmin` (já disponível via `useUserRole`).
- Migration: recriar `public.meta_atendimentos_por_atendente` (SECURITY DEFINER, STABLE) com guarda `if not has_role(auth.uid(),'admin') then return; end if;` — reverte a liberação geral feita anteriormente, mantendo os demais filtros e agrupamentos.
- Nenhum novo cron, polling, Realtime ou tabela. Custo de backend reduzido.

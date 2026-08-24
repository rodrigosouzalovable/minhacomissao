# Painel de Atendimentos por Atendente (substitui o sino do IAGO)

Trocar o segundo sino do topo do Inbox API Oficial Meta por um ícone de métricas (BarChart3) que abre um painel com a quantidade de conversas de cada atendente.

## O que o painel mostra

Para cada atendente, duas métricas separadas:
- **Atendidas (manual)** — contatos distintos que receberam ao menos uma mensagem manual do atendente (texto, áudio, mídia; sem template).
- **Iniciadas (template)** — contatos distintos que receberam template/campanha enviada pelo login do atendente.

Três abas de período: **Hoje**, **Semana** (últimos 7 dias) e **Mês** (mês atual), todas no fuso de Brasília.

O ícone traz um badge com o total do dia do próprio usuário.

## Permissões

- Admin: vê a lista completa de todos os atendentes, ordenada pelo maior volume, mais o total geral.
- Demais usuários (inclusive Parceiros Meta): veem apenas a própria linha.

## Detalhes técnicos

1. Nova função de banco `meta_atendimentos_por_atendente(p_inicio timestamptz, p_fim timestamptz)`, `SECURITY DEFINER`, `search_path = public`:
   - Base: `meta_whatsapp_mensagens` com `direcao = 'saida'` no intervalo, agrupada por `user_id`.
   - `atendidas` = `count(distinct telefone)` onde `template_nome is null`.
   - `iniciadas` = `count(distinct telefone)` onde `template_nome is not null`.
   - Junta `profiles` para o nome do atendente.
   - Dentro da função: se `has_role(auth.uid(), 'admin')` retorna todas as linhas; caso contrário filtra `user_id = auth.uid()`.
   - `GRANT EXECUTE` para `authenticated`.
2. Novo componente `src/components/inbox/meta/AtendimentosBell.tsx` (Popover + Tabs de período + botão de atualizar), consultando a RPC via React Query com `staleTime` alto (5 min) e sem polling — sem custo recorrente de Cloud.
3. `src/pages/InboxMeta.tsx`: substituir `<AvisosIagoBell />` por `<AtendimentosBell />` na linha do cabeçalho.
4. `AvisosIagoBell.tsx` deixa de ser usado no Inbox e será removido do cabeçalho (arquivo excluído).

## Observação

A atribuição usa o login que efetivamente enviou a mensagem. Mensagens enviadas automaticamente pelo IAGO ficam sob o dono da instância; se preferir excluí-las da contagem, é possível filtrar por origem em um ajuste posterior.

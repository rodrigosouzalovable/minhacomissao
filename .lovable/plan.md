# Estatísticas diárias de consultas de CPF

Adicionar um painel de estatísticas no topo do popover do sininho (`NotificacoesCpfBell`) na aba Inbox Meta, mostrando quantas consultas de CPF entraram pelo portal por dia.

## Comportamento por perfil

**Funcionário (habilitado a receber consultas):**
- Card único "Hoje" com dois números:
  - Consultas atribuídas a ele hoje (total)
  - Ainda não lidas / disponíveis (não lidas)
- Sem histórico de outros dias.

**Admin:**
- Card "Hoje" com total global (todos os funcionários) + não lidas globais.
- Lista compacta abaixo com os últimos 7 dias:
  ```text
  Hoje       42
  Ontem      37
  Seg 06/07  51
  Dom 05/07  0
  ...
  ```
- Rodapé com média diária dos últimos 7 dias (ignorando o dia atual) para comparação rápida.

## Onde muda

`src/components/inbox/meta/NotificacoesCpfBell.tsx` — único arquivo alterado:
1. Nova consulta agregada ao abrir o popover (e no realtime já existente):
   - Funcionário: `count` em `consulta_cpf_notificacoes` de hoje onde `assigned_user_id = user.id`.
   - Admin: busca `created_at` das últimas ~2000 linhas dos últimos 7 dias e agrupa no cliente por data BRT (`America/Sao_Paulo`) — evita RPC nova.
2. Novo bloco JSX entre o header ("Consultas de CPF") e a lista de notificações, com os cards/linhas descritos acima.
3. Estilos com tokens semânticos existentes (sem cores hardcoded).

## Fora do escopo
- Nenhuma migração de schema (a tabela `consulta_cpf_notificacoes` já tem `created_at` e `assigned_user_id`).
- Nenhuma mudança na edge `notify-cpf-consulta` nem nas regras de rodízio.
- Sem gráfico — apenas números/lista textual, mantendo o popover leve.

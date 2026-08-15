# Qualificações secundárias (motivos) no Inbox Meta Oficial

Objetivo: cada qualificação primária (ex.: "Sem interesse") pode ter qualificações secundárias vinculadas (o motivo). Quando o atendente marca a primária, ele precisa escolher o motivo.

## 1. Configurar os motivos (só admin)

- No diálogo "Qualificação", clique com o botão direito sobre uma qualificação → menu com "Configurar motivos".
- Abre um painel do tipo "Motivos de: Sem interesse", onde o admin pode:
  - criar novo motivo (nome + cor),
  - renomear e trocar cor,
  - ativar/inativar (mantém histórico),
  - excluir apenas quando nenhuma conversa usa aquele motivo (senão sugere inativar).
- Usuários não admin veem o menu de contexto apenas como leitura (sem opção de configurar).

## 2. Como o atendente usa

- A lista continua mostrando só as qualificações primárias.
- Ao clicar em uma primária que tem motivos ativos, o diálogo avança para a lista de motivos e pede a escolha antes de gravar. É possível marcar mais de um motivo.
- Fechar sem escolher motivo não grava a primária (aviso "selecione o motivo").
- Primárias sem motivos configurados continuam funcionando com um clique, como hoje.
- Depois de gravada, a conversa mostra a primária e, abaixo/junto, o motivo escolhido. Clicar na primária marcada permite desmarcar (remove primária + motivos) ou trocar o motivo.

## 3. Excel

- Exportação de "Qualificações lançadas" (sino de CPF) ganha as colunas **Qualificação** (primária) e **Motivo** (secundárias, separadas por vírgula quando houver mais de uma).
- Exportação de "Meus Clientes" passa a mostrar o marcador no formato `Sem interesse (Preço alto)`.
- Filtro de marcadores em "Meus Clientes" continua por primária, com os motivos indentados abaixo para filtrar mais fino.

## Detalhes técnicos

- Migração: `meta_qualificacoes` recebe `parent_id uuid references public.meta_qualificacoes(id) on delete cascade` (null = primária) + índice por `parent_id`. RLS/GRANTs atuais permanecem (leitura autenticada, escrita admin).
- Registro do motivo reaproveita `meta_contato_qualificacao` (linhas com `qualificacao_id` do motivo), sem nova tabela; a agregação distingue primária/motivo pelo `parent_id`.
- `src/components/inbox/meta/MetaQualificacaoDialog.tsx`: separar `primarias`/`motivosPorPai`, `ContextMenu` por item, novo modo "motivos" no painel de configuração, e gravação em lote (primária + motivos escolhidos) numa única chamada.
- `src/pages/InboxMeta.tsx`: `fetchQualificacoes` já traz todas as linhas; ajustar montagem dos selos no header e no filtro de marcadores para agrupar por `parent_id`.
- `src/components/inbox/meta/NotificacoesCpfBell.tsx`: agrupar por contato para preencher as colunas Qualificação/Motivo na exportação paginada existente.
- Relatório de WhatsApp (`relatorio-acionamentos-sync`) mantém a contagem por primária, com os motivos listados indentados sob cada primária.

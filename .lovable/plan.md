# Acelerar a Inbox Meta Oficial sem alterar suas regras

## Diagnóstico verificado

- A lista comum já carrega 300 conversas por vez e usa um índice de ordenação. Sem aplicar as permissões de um usuário específico, a consulta de 300 conversas na caixa Padrão levou cerca de 3 ms no banco; isso **não demonstra** que a experiência de todos os usuários seja rápida.
- Os filtros “Meus Clientes” e “Etiquetas” ainda percorrem vínculos em páginas de até 1.000, depois buscam conversas em lotes de 200 **sequencialmente**, ordenam tudo no navegador e só então mostram o primeiro lote. O índice por etiqueta já existe; recriá-lo não ajudaria.
- A lista é buscada novamente ao voltar à aba e após eventos de conversas; etiquetas e qualificações são lidas para os contatos exibidos. A tela renderiza todos os itens carregados, sem virtualização. Essas operações podem somar espera e travamento visual, especialmente para quem atende muitas conversas.
- As estatísticas acumuladas do banco mostram muitas consultas relacionadas à Inbox: busca por etiqueta (~563 mil chamadas, média histórica 732 ms), qualificações (~800 mil, média 96 ms) e lista de conversas (diversas variantes). Esses números incluem períodos anteriores às otimizações já feitas e **não medem isoladamente a lentidão atual**. Os registros recentes do preview consultados não mostram falhas de requisição; faltam medições de duração por usuário/caixa.

## Melhorias propostas

1. **Medir antes e depois:** cronometrar no navegador a abertura da Inbox, troca de caixas, “Meus Clientes”, filtro por etiqueta e abertura de conversa; comparar administrador e usuário comum, além de consultar planos de execução com permissões reais antes de qualquer alteração no banco.
2. **Tornar os filtros paginados no servidor:** retornar diretamente o primeiro lote de conversas ordenadas para “Meus Clientes” e “Etiquetas”, com “carregar mais” sob demanda. Manter busca em todo o histórico, seleção de caixa/instância, datas, arquivadas e exportação completa; validar que nenhuma conversa permitida desaparece e que as permissões permanecem iguais.
3. **Evitar releituras concorrentes:** agrupar solicitações simultâneas ao voltar à aba ou receber eventos, não repetir busca sem mudança relevante e descartar resultados antigos quando o usuário muda rapidamente de caixa/filtro. Preservar atualização de mensagens e etiquetas em tempo real, inclusive quando o usuário retorna à aba.
4. **Reduzir trabalho visual se a medição confirmar travamento:** renderizar apenas as conversas visíveis ao rolar listas longas, preservando a posição, o menu de ações e a seleção múltipla. Não mexer na renderização das mensagens sem evidência de que é gargalo.
5. **Validar segurança e experiência:** conferir caixas Padrão e restritas, resultados completos de busca/filtros, não lidas, etiquetas, exportação, conversa aberta e atualizações em tempo real; comparar duração e volume de requisições antes/depois e reverter qualquer regressão de acesso.

## Detalhes técnicos

- Examinar `src/pages/InboxMeta.tsx` nas leituras `fetchContatos`, `fetchContatoEtiquetas` e `fetchQualifContatos`; implementar paginação da consulta filtrada sem descarregar previamente todos os IDs no cliente. Qualquer função de consulta nova deverá validar o acesso às caixas no servidor e manter RLS/grants corretos; preferir segurança invoker ou uma checagem explícita equivalente à existente.
- Os índices de contatos por caixa/ordem e de vínculos por `(etiqueta_id, contato_id)` já existem. Só criar outro índice se um `EXPLAIN (ANALYZE, BUFFERS)` do caminho real demonstrar necessidade.
- Não adicionar cron, polling, canal em tempo real nem consultas periódicas. A intenção é **reduzir** leituras e custo da Lovable Cloud; alterações em índices, caso justificadas, terão custo pontual de criação e armazenamento, a dimensionar antes de executar.

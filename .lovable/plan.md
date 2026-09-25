# Reduzir consultas que travam a Inbox Meta

## Diagnóstico confirmado
- O banco registrou cancelamentos de consultas por tempo limite. Os dados acumulados apontam sobretudo para a Inbox Meta: a leitura de contatos por etiqueta ocorreu mais de 539 mil vezes, com média de 729 ms e picos de 8 s; outra consulta de contagem de conversas não lidas ocorreu mais de 196 mil vezes, com média próxima de 1 s e picos de 8 s. Esses totais são históricos, portanto não provam isoladamente quais consultas compuseram os 100 cancelamentos daquela janela.
- A tabela de vínculos entre contatos e etiquetas tem índice por contato/etiqueta, mas não por etiqueta/contato, usado nos filtros “Meus Clientes” e “Etiquetas”. A listagem percorre até 20 páginas de vínculos e depois consulta os contatos em lotes. O carregamento básico já tem limite, cache curto e agrupamento de eventos em tempo real; não se deve adicionar mais consultas frequentes.
- As regras de acesso das etiquetas e dos contatos fazem checagens por caixa para cada linha. Uma mudança nelas pode expor conversas de outras caixas, portanto precisa de validação de permissões antes de ser aplicada.

## Correção proposta
1. Medir com `EXPLAIN (ANALYZE, BUFFERS)` os filtros reais por etiqueta e por não lidas, separando custo do índice e custo das regras de acesso, com papéis de usuário adequados. Identificar também os chamadores da contagem de não lidas e a frequência real das chamadas.
2. Adicionar somente índices comprovadamente utilizados nos planos, começando por `(etiqueta_id, contato_id)` para o filtro de etiquetas. Confirmar ganho com nova medição; não criar índices na grande tabela de devedores sem evidência de que ela participa deste gargalo.
3. Se a checagem de permissões continuar dominante, substituir leituras repetidas por uma consulta paginada que valida a caixa uma vez por conversa, preservando exatamente o acesso atual de administradores, membros de caixa e usuários compartilhados. Limitar paginação e evitar nova rotina contínua.
4. Comparar tempo, páginas lidas e número de chamadas antes/depois; testar Inbox Meta com administrador e usuário comum, inclusive caixa Padrão, caixa restrita, “Meus Clientes”, filtros e não lidas. Reverter qualquer mudança que amplie acesso.

## Detalhes técnicos
- Usar estatísticas de consultas e planos de execução do banco para escolher o índice e o caminho de leitura; migrations para índices/funções, alterações de tela apenas se as medições apontarem chamadas redundantes.
- Sem novo cron, polling ou canal em tempo real. O objetivo é reduzir leituras e custo da Lovable Cloud. A criação de índice tem custo pontual de escrita e armazenamento, a ser dimensionado antes da execução.
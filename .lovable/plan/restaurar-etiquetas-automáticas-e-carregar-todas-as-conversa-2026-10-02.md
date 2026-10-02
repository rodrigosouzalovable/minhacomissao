# Restaurar etiquetas automáticas e carregar todas as conversas não lidas

## Resultado esperado

- Toda nova mensagem recebida de cliente ficará vinculada a exatamente um atendente elegível da caixa.
- Na caixa **Padrão**, o IAGO participa do rodízio normal junto com os atendentes humanos; ele não assume todas as conversas.
- O IAGO responde somente quando a conversa estiver atribuída a ele, de forma direta e curta, preservando a transferência para humano e a regra sem follow-up.
- Nas demais caixas, o rodízio considera somente os atendentes humanos cadastrados naquela caixa; o IAGO não participa.
- Ao selecionar **Não lidas**, o Inbox mostrará todas as conversas não lidas da caixa atual, e não apenas as que já estavam carregadas na tela.

## Situação confirmada

- O recebimento possui várias prioridades antes do rodízio e, na caixa Padrão, hoje há um caminho que atribui diretamente o IAGO em vez de colocá-lo na vez normal da fila.
- A função atual de rodízio já separa a sequência por caixa, exige atendente ativo, permissão de Inbox e vínculo com a caixa, mas pode retornar sem atribuir ninguém quando não encontra elegível.
- A exclusividade atual depende de uma trava lógica e não cobre com segurança duas atribuições simultâneas em uma conversa ainda sem etiqueta.
- Existem atualmente **1.464 conversas não lidas na Padrão** e **2.443 nas outras caixas**; o filtro visual só examina o lote carregado, limitado inicialmente às 300 conversas mais recentes.
- A busca combinada por etiquetas/qualificações também não possui hoje um parâmetro para filtrar as não lidas diretamente na base.

## Alterações

### 1. Uma atribuição única e segura por mensagem recebida

- Centralizar a escolha do atendente em uma operação atômica por conversa, evitando decisões concorrentes e etiquetas duplicadas.
- Manter as prioridades válidas já existentes, como acordo/atendente previamente identificado, desde que o operador continue elegível naquela caixa.
- Quando não houver uma prioridade válida, chamar o rodízio circular da caixa.
- Remover da caixa Padrão a atribuição automática do IAGO antes do rodízio: ele passa a receber somente na vez dele.
- Se a conversa já tiver uma etiqueta de atendente válida, mantê-la; uma nova mensagem não trocará o responsável.
- Se nenhum atendente estiver elegível, manter a conversa visível e registrar o motivo para correção administrativa, sem atribuir pessoa de outra caixa.

### 2. IAGO econômico e restrito à Padrão

- Permitir resposta automática somente quando a etiqueta atual for a do IAGO e a conversa estiver na caixa Padrão.
- Preservar respostas curtas, sem follow-up, e interromper a IA assim que houver atendimento ou transferência humana.
- Não adicionar chamadas recorrentes, polling ou novas execuções de IA.

### 3. Corrigir conversas atuais sem atendente

- Aplicar o rodízio às conversas **não lidas atuais** que possuem mensagem de entrada e estão sem etiqueta, respeitando caixa, permissões e elegibilidade.
- Não redistribuir conversas que já têm atendente e não reabrir conversas antigas já lidas.
- Gerar uma conferência final por caixa: corrigidas, já atribuídas e sem elegível.

### 4. “Não lidas” consultadas na base completa

- Ao clicar em **Não lidas**, incluir `nao_lido > 0` na consulta antes da paginação.
- Fazer a troca Todas/Não lidas reiniciar a página e buscar novamente os resultados da caixa, instância e aba atuais.
- Ampliar a busca combinada por etiquetas/qualificações para aceitar o mesmo filtro de não lidas.
- Preservar busca por nome/telefone, caixa, instância, Conversas/Arquivados, datas, etiquetas e qualificações.
- Manter a atualização em tempo real já existente: novas entradas aparecem, e uma conversa sai da lista ao ser lida, sem polling novo.

## Validação

- Simular uma rodada completa na caixa Padrão e confirmar a ordem entre humanos e IAGO, com uma única etiqueta por conversa.
- Confirmar que o IAGO responde apenas na vez dele e não responde em outras caixas.
- Enviar duas entradas simultâneas para a mesma conversa e confirmar que não surgem etiquetas duplicadas.
- Comparar a quantidade exibida em **Não lidas** com a quantidade total da caixa na base, incluindo resultados além dos primeiros 300.
- Testar o filtro de não lidas combinado com instância, busca, etiquetas, qualificações e Arquivados.
- Conferir que abrir uma conversa zera o contador e a remove corretamente da lista de não lidas.

## Impacto técnico e custo

- Ajustes no webhook do Inbox, no rodízio atômico, na consulta combinada e na tela do Inbox.
- Sem cron, novo canal em tempo real, polling ou chamada adicional de IA.
- A consulta de não lidas será executada somente quando o usuário selecionar esse filtro, com filtro na base antes da paginação.

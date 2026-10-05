# Não lido permanece até a conversa ser respondida — Inbox Meta Oficial

## Resultado esperado

- Quando uma mensagem do cliente chegar, o card ficará como **não lido / aguardando resposta**.
- Abrir a conversa esconderá temporariamente o indicador enquanto ela estiver sendo visualizada.
- Se o usuário sair ou trocar de conversa sem responder, o indicador reaparecerá automaticamente no card.
- O indicador só desaparecerá definitivamente após algum envio bem-sucedido ao cliente.
- Contam como resposta: texto, áudio, imagem, vídeo, documento, botões, template e resposta automática, conforme definido.
- Se uma nova mensagem chegar depois da resposta, a conversa volta a ficar não lida normalmente.

## Situação confirmada

- Hoje, abrir a conversa grava imediatamente `nao_lido = 0` no contato, mesmo sem resposta.
- Sair ou trocar de conversa não possui lógica para restaurar essa pendência.
- Os envios atualizam a última mensagem do card, mas os principais caminhos de envio não eliminam o não lido de forma centralizada e protegida.
- O filtro **Não lidas** já consulta `nao_lido > 0` antes da paginação; portanto, ele continuará mostrando a lista completa com a nova regra.
- O recebimento atual incrementa o contador por leitura seguida de atualização, o que pode perder contagens quando duas mensagens chegam simultaneamente.

## Alterações

### 1. Abrir sem responder não conclui a pendência

- Remover o zeramento definitivo feito ao abrir a conversa.
- Enquanto a conversa estiver aberta, ocultar o indicador somente na tela daquele usuário.
- Ao fechar ou trocar de conversa, restaurar imediatamente o indicador no card se ainda não houver resposta posterior à última entrada.
- Manter a conversa na base como não lida durante a visualização, para que outro atendente não a considere resolvida apenas porque alguém a abriu.

### 2. Resposta bem-sucedida encerra o não lido

- Centralizar uma operação atômica que marque a conversa como respondida somente quando o envio for posterior à última mensagem recebida.
- Aplicar essa operação após sucesso em todos os envios do Inbox Meta Oficial: texto, áudio, arquivos, mídia, botões, templates e automações.
- Não limpar o indicador quando o envio falhar.
- Proteger contra simultaneidade: se o cliente enviar outra mensagem durante ou depois do envio, essa nova entrada continuará não lida.

### 3. Recebimentos simultâneos sem perda

- Tornar atômico o incremento de mensagens não lidas no webhook Meta e nos fluxos espelhados usados pelo Inbox.
- Preservar o total correto mesmo quando várias mensagens chegarem quase juntas.
- Manter a atualização em tempo real já existente, sem nova consulta periódica.

### 4. Compatibilidade com os controles atuais

- Preservar **Marcar como não lida**, filtros, etiquetas, caixas, paginação, alertas de espera e a opção **Não precisa resposta**.
- Garantir que o filtro **Não lidas** não remova definitivamente um card apenas porque ele foi aberto.
- Não alterar regras de atribuição de atendente, IAGO, arquivamento ou retenção além da nova interpretação do estado não lido.

## Validação

- Receber uma mensagem, abrir e sair sem responder: o indicador reaparece.
- Abrir e trocar diretamente para outro cliente sem responder: o primeiro card reaparece como não lido.
- Responder por cada formato suportado: o indicador some somente após confirmação do envio.
- Simular uma nova entrada durante o envio: ela permanece não lida.
- Simular duas entradas simultâneas: o contador não perde mensagens.
- Confirmar que **Não lidas** continua encontrando resultados além do primeiro lote e combina com os demais filtros.
- Confirmar o comportamento em duas sessões de atendentes abertas ao mesmo tempo.

## Detalhes técnicos e custo

- Ajustar o estado temporário de visualização em `InboxMeta.tsx` sem gravar leitura definitiva ao abrir.
- Criar operações autenticadas e atômicas para incrementar a entrada e concluir a pendência após envio, com comparação de horários para evitar condições de corrida.
- Integrar a conclusão nos pontos de envio oficiais e automáticos que registram mensagens de saída.
- Sem novo cron, polling, canal em tempo real ou chamada de IA. O número de operações permanece equivalente ou menor, pois o incremento deixa de exigir leitura prévia; não há aumento relevante de custo do Lovable Cloud.

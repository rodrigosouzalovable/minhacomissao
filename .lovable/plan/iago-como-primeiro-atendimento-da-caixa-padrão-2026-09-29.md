# IAGO como primeiro atendimento da caixa PADRÃO

## Objetivo

Transformar o IAGO no primeiro responsável por todas as mensagens elegíveis recebidas na caixa **PADRÃO**, 24 horas por dia e 7 dias por semana. Ele deverá considerar toda a conversa antes de responder, identificar-se como assistente virtual e transferir para um único atendente humano pelo rodízio existente quando o cliente pedir ou quando não souber responder.

A mudança ficará restrita à caixa **PADRÃO**. CERTIFICADO/Clara, AQUECIMENTO e demais caixas continuarão com as regras atuais.

## Comportamento esperado

1. **IAGO assume a caixa PADRÃO**
   - Toda conversa nova sem transferência humana será atribuída ao IAGO, sem depender do horário de plantão.
   - Conversas atuais da PADRÃO também passam a ser atendidas quando chegar uma nova mensagem, desde que ainda não estejam formalmente com um humano.
   - Conversas já transferidas ou assumidas por um funcionário permanecem humanas.

2. **Leitura completa antes de responder**
   - Antes de cada resposta, carregar todo o histórico disponível da conversa, na ordem correta, incluindo mensagens enviadas pela equipe/IAGO e respostas do cliente.
   - Áudios transcritos, imagens interpretadas e propostas já enviadas entram no contexto.
   - O IAGO deverá interpretar a mensagem atual em conjunto com esse histórico antes de informar nome, credor, valores, proposta, prazo ou próxima etapa.
   - As regras determinísticas e os valores calculados pelo sistema continuam tendo prioridade; a IA não poderá inventar informações.

3. **Identificação transparente**
   - Na primeira resposta do atendimento, o IAGO se apresenta como **assistente virtual**.
   - Nessa apresentação, informa que o cliente pode escrever “quero falar com humano” ou algo semelhante para ser transferido.
   - Nas respostas seguintes, não repete essa apresentação desnecessariamente; se perguntarem se ele é robô/IA, responde com transparência.

4. **Pedido de atendimento humano**
   - Criar reconhecimento direto e tolerante a variações como “quero falar com humano”, “falar com atendente”, “pessoa de verdade”, “me transfere”, erros de digitação e frases equivalentes.
   - Ao detectar o pedido, o IAGO confirma brevemente a transferência, cancela qualquer follow-up e para de responder naquela conversa.
   - A detecção será feita antes da chamada de IA, para não depender da interpretação do modelo.

5. **Transferência pela fila existente**
   - Remover a responsabilidade do IAGO e selecionar **um único atendente** pelo rodízio da caixa PADRÃO.
   - Considerar somente funcionários ativos, autorizados no Inbox e selecionados na caixa; administradores que apenas acompanham continuam fora do rodízio conforme a regra atual.
   - Aplicar a etiqueta do atendente escolhido e manter “Aguardando Humano” como indicação de transferência.
   - Se não houver atendente elegível, preservar a conversa em espera humana e emitir o aviso existente, sem devolver o atendimento ao IAGO silenciosamente.

6. **Humano assumiu**
   - Qualquer mensagem manual de funcionário encerra a atuação automática do IAGO naquela conversa.
   - Diferentemente da regra atual de pausa por 10 minutos, na PADRÃO essa transferência será definitiva até uma ação explícita de devolução ao IAGO.
   - Novas mensagens do cliente permanecem com o atendente humano escolhido.

7. **IAGO não soube responder**
   - Quando a resposta não estiver coberta pelos dados e ensinamentos, o IAGO não inventa e não envia conteúdo incerto.
   - Ele informa brevemente que chamará um atendente e usa exatamente o mesmo fluxo de rodízio humano.
   - Falha técnica na IA também encaminha a conversa, evitando que o cliente fique sem responsável.

## Proteções e continuidade

- Manter deduplicação por mensagem, trava de uma execução por conversa, limite diário anti-loop, opt-out, blacklist, número errado, falecimento e proteção contra respostas duplicadas.
- Depois da transferência, follow-ups do IAGO ficam cancelados e todas as entradas automáticas respeitam o estado humano.
- Não criar novo agendamento, polling ou canal em tempo real.
- O aumento de consumo foi autorizado: haverá uma chamada de IA para cada entrada elegível da caixa PADRÃO, mantendo os limites de segurança existentes.

## Detalhes técnicos

- Ajustar o recebimento Meta para atribuir o IAGO 24h/7 somente quando `folder_id` representar a caixa PADRÃO e a conversa não estiver transferida para humano.
- Criar uma operação atômica de transferência que remova a etiqueta do IAGO e chame o rodízio existente; isso é necessário porque o rodízio atual retorna a etiqueta já vinculada se ela não for removida antes.
- Adaptar o atendimento do IAGO com um modo exclusivo da PADRÃO para:
  - carregar e enviar o histórico completo ao modelo;
  - usar persona transparente de assistente virtual;
  - detectar pedido humano antes da IA;
  - registrar transferência definitiva e impedir retomada automática após 10 minutos.
- Manter a chamada de IA no modelo e protocolo atuais, com histórico completo, sem alterar outras caixas.
- Registrar a decisão técnica e a nova regra funcional na documentação do projeto.

## Validação

- Testar conversa nova e conversa já existente na PADRÃO.
- Confirmar que a primeira resposta apresenta o IAGO como assistente virtual e oferece a opção de humano.
- Testar retomada de assunto antigo e proposta anterior para comprovar leitura de mensagens dos dois lados.
- Testar várias formas de pedir humano e confirmar uma única etiqueta humana escolhida pelo rodízio.
- Confirmar que mensagem manual do funcionário silencia o IAGO definitivamente naquela conversa.
- Simular dúvida e falha da IA para confirmar encaminhamento seguro.
- Confirmar que CERTIFICADO, AQUECIMENTO e demais caixas não mudaram.
- Validar duplicidade, follow-up cancelado, tela pequena, logs e ausência de erros, sem enviar mensagens reais para clientes durante os testes.

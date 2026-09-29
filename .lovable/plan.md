# Melhorar o atendimento da Clara no Certificado Digital

## Objetivo

Fazer a Clara responder corretamente às dúvidas e avanços comerciais mostrados na conversa da **KATATEX**, mantendo o atendimento automático até o momento certo de encaminhar ao humano.

## Situação confirmada

- Hoje a Clara é instruída a encaminhar qualquer dúvida sobre validade para atendimento humano. Por isso, ao receber **“Qual período?”**, respondeu que encaminharia a dúvida e encerrou a automação daquela conversa.
- A configuração atual já contém as mensagens corretas para agendamento e solicitação dos documentos, mas elas dependem da interpretação da IA e não foram usadas no caso mostrado.
- A conversa da KATATEX ficou marcada como **aguardando humano** após a pergunta sobre o período; as respostas posteriores foram feitas pelo atendente Rodrigo.
- O atendimento já possui reserva atômica por mensagem, bloqueio após entrada de atendente humano e aviso administrativo idempotente.

## Alterações

1. **Responder dúvidas sobre validade**
   - Reconhecer perguntas como “qual período?”, “quanto tempo vale?”, “qual a validade?” e equivalentes.
   - Responder diretamente: **“O certificado digital PJ A1 possui validade de 1 ano.”**
   - Não marcar a conversa como aguardando humano apenas por essa dúvida.

2. **Explicar como proceder**
   - Quando o cliente perguntar “Como procedo?”, “Como faço?”, “Qual o próximo passo?” ou equivalente após demonstrar interesse, responder exatamente:
   - **“Para a emissão do certificado digital, é necessário agendar com você uma videoconferência hoje, que leva apenas três minutos. Podemos realizar o agendamento?”**
   - Manter a conversa na etapa de confirmação do agendamento.

3. **Tratar a confirmação do cliente**
   - Quando o cliente responder “sim”, “pode”, “vamos”, “quero agendar” ou equivalente nessa etapa, responder exatamente:
   - **“Para que possamos realizar o agendamento da videoconferência para emissão do seu certificado digital é necessário que nos encaminhe o seu CNPJ seu e-mail e uma CNH que pode ser física ou digital. Consegue nos enviar por gentileza?”**
   - Passar a conversa para a etapa de espera dos documentos.

4. **Preservar contexto e segurança**
   - Registrar explicitamente no estado da conversa se a Clara está apresentando a oferta, aguardando confirmação do agendamento ou aguardando documentos.
   - Aplicar as respostas determinísticas antes da interpretação livre da IA, evitando que perguntas simples sejam encaminhadas ao humano.
   - Manter encaminhamento humano para situações sensíveis, dúvidas não cobertas, pedido explícito de atendente ou após o recebimento completo de CNPJ, e-mail e CNH.
   - Preservar a proteção contra respostas duplicadas e não reativar conversas já assumidas por um atendente humano.

## Validação

- Testar uma conversa nova com a sequência: oferta → **“Qual período?”** → **“Como procedo?”** → **“Sim”**.
- Confirmar que as três respostas saem na ordem correta e que a conversa não recebe a etiqueta **Aguardando Humano** antes do envio dos documentos.
- Testar variações equivalentes de validade, próximo passo e confirmação.
- Confirmar que recusa, pedido de bloqueio e pedido de atendente continuam seguindo as regras atuais.
- Verificar os registros da função e a compilação, sem enviar mensagens reais para clientes durante o teste.

## Custo e operação

A mudança não cria agendamento, consulta repetitiva ou chamada adicional de IA. Ela torna respostas conhecidas determinísticas dentro da chamada já existente, com impacto operacional neutro e tendência de reduzir encaminhamentos desnecessários.

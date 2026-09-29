# Corrigir a interpretação da Clara na caixa CERTIFICADO

## Situação confirmada

- A conversa da **TEKONT CONTABILIDADE** recebeu primeiro uma resposta automática de ausência e, nesse momento, a Clara marcou o atendimento como **aguardando humano**.
- Por essa trava, as mensagens posteriores **“Não entendi”** e **“Sou responsável sim”** foram registradas, mas a Clara não voltou a interpretá-las.
- O histórico completo está disponível; a falha ocorreu antes da interpretação dessas duas mensagens, não por falta de contexto.

## Correção

1. **Reconhecer respostas automáticas**
   - Identificar mensagens típicas de ausência, horário comercial, férias ou confirmação automática.
   - Registrar a mensagem no histórico, mas não encerrar o atendimento nem aplicar **Aguardando Humano** somente por esse motivo.

2. **Interpretar a sequência da conversa**
   - Antes de decidir, ler as mensagens enviadas e recebidas em ordem, incluindo respostas consecutivas do cliente.
   - Tratar **“Não entendi” + “Sou responsável sim”** como pedido de esclarecimento e confirmação do responsável.
   - Nesse cenário, explicar a finalidade do contato e apresentar a oferta correta de renovação do certificado digital PJ A1 por **R$ 129,90**, perguntando se há interesse.

3. **Evitar travas indevidas**
   - Encaminhar ao humano apenas quando houver pedido explícito, situação sensível ou dúvida realmente não coberta.
   - Preservar opt-out, deduplicação atômica, interrupção após atendimento humano e proteção contra respostas repetidas.
   - Não repetir o template inicial nem enviar duas respostas quando o cliente mandar mensagens em sequência.

4. **Corrigir a conversa mostrada**
   - Retirar somente a trava indevida dessa conversa e devolvê-la à etapa comercial da Clara.
   - Não enviar mensagem retroativa ao cliente durante a correção; a Clara continuará corretamente na próxima interação, evitando um disparo real sem confirmação.

## Validação

- Testar a sequência: template inicial → resposta automática → “Não entendi” → “Sou responsável sim”.
- Confirmar que a Clara apresenta a oferta, não marca **Aguardando Humano** e mantém o contexto para interesse, agendamento e documentos.
- Testar também recusa, número errado, opt-out, pedido de humano e duas entregas simultâneas do mesmo evento.
- Publicar a função e validar os testes sem enviar mensagens reais.

## Custo e operação

A correção não cria rotina, consulta periódica ou chamada adicional contínua. Ela aproveita o histórico já lido no atendimento e tende a reduzir encaminhamentos desnecessários.

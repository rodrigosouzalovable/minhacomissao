# IAGO: ler a proposta que já enviamos antes de pedir CPF

## O que acontece hoje (confirmado no código)

- A primeira mensagem da conversa (campanha/template) já traz a proposta à vista com valor.
- Quando o IAGO responde, ele só decide entre "cliente identificado" e "cliente não identificado": se não achou CPF pelo telefone, o texto do prompt manda **pedir o CPF**, sem considerar que já existe valor enviado no histórico.
- Resultado: ele pede CPF depois de nós já termos passado a proposta, como no print.

## Correção

1. **Detectar proposta já enviada por nós**
   - Antes de montar a resposta, olhar as mensagens de saída da conversa e identificar se alguma já contém valor (R$) e/ou fala de pagamento à vista/parcelado — inclusive as mensagens de campanha/template enviadas antes do IAGO entrar.
   - Extrair o valor e o texto dessa mensagem para usar como contexto.

2. **Nova regra de conduta**
   - Havendo proposta já enviada: é **proibido** pedir CPF de entrada. O IAGO retoma a proposta: pergunta se a cliente conseguiu ver a condição de pagamento à vista de R$ X e o que achou, oferecendo ver opções de parcelamento se preferir.
   - Só pedir CPF depois, se a cliente demonstrar interesse e for realmente necessário para calcular parcelamento — e explicando o porquê.
   - Nunca repetir o valor de forma diferente do que foi enviado: usa exatamente o valor da mensagem anterior enquanto o sistema não tiver os débitos calculados.

3. **Respostas automáticas do cliente**
   - Mensagem claramente automática ("aguarde um instante, já te respondo", link de Instagram etc.) não é tratada como resposta real: o IAGO responde retomando a proposta, sem responder ao conteúdo automático nem comentar o link.

4. **Registro de estado**
   - Marcar `proposta_enviada` no estado da conversa também quando a proposta veio de mensagem nossa anterior (campanha), para o follow-up já usar o texto correto ("conseguiu ver a proposta?").

## Detalhes técnicos

- `supabase/functions/iago-atendimento/index.ts`:
  - novo helper que varre `historico` (direção saída) buscando padrão `R$ <valor>` + termos de proposta, retornando `{ valor, texto }`;
  - passar `propostaPrevia` para `montarResposta` e adicionar bloco no system prompt: retomada obrigatória, proibição de pedir CPF nesse caso, uso do valor original;
  - ajustar o texto `semDebito` para não pedir CPF quando `propostaPrevia` existir;
  - detecção simples de auto-resposta (frases padrão + presença de link) para instruir a ignorar o conteúdo;
  - gravar `contexto.proposta_enviada = true` quando `propostaPrevia` existir.
- Sem novo cron, tabela ou polling — usa o histórico já carregado na mesma execução.

## Validação

- Simular conversa igual ao print (proposta enviada + auto-resposta): a resposta deve perguntar se viu a condição à vista de R$ 1.342,40 e oferecer parcelamento, sem pedir CPF.
- Simular conversa sem nenhum valor enviado: comportamento atual mantido (pede CPF).

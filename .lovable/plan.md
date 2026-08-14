# IAGO: follow-up só fala de proposta quando existe proposta

## O que está acontecendo (confirmado no código)

- O follow-up (`iago-followup-tick`) usa **um texto fixo** ("...se você viu a proposta que te mandei"), sem olhar nada do que foi conversado.
- Na conversa da imagem, o IAGO só havia pedido o CPF — nenhuma proposta/valor foi enviado — e ainda assim o follow-up falou de "proposta".
- O estado da conversa já registra a etapa (`proposta` quando valores foram calculados e enviados; `conversando` quando não), então dá para distinguir os dois casos.

## O que será feito

1. **Registrar oficialmente se a proposta foi enviada**
   - Quando o IAGO efetivamente envia valores (dívida, desconto à vista, opções de parcelamento), a conversa passa a guardar essa marca.
   - Se ele só cumprimentou, pediu CPF ou tirou dúvida, a conversa fica marcada como "sem proposta enviada".

2. **Follow-up ciente da conversa**
   - Antes de escrever, o follow-up passa a **ler as últimas mensagens trocadas** naquela conversa (cliente e IAGO).
   - Com proposta enviada: mantém a retomada atual ("conseguiu ver a proposta?").
   - Sem proposta enviada: o texto é gerado a partir do que realmente falta — por exemplo, retomar o pedido do CPF de forma educada, sem inventar proposta, sem repetir apresentação e sem repetir palavra por palavra algo já enviado.
   - Se a última coisa enviada já for exatamente esse pedido e o cliente respondeu "não"/algo confuso, o follow-up esclarece o motivo do contato (credor da caixa) em vez de repetir a mesma frase.

3. **Trava anti-repetição no follow-up**
   - Comparação com as saídas recentes: se o texto gerado for igual ou muito parecido com algo já enviado, o follow-up é cancelado em vez de mandar mensagem redundante.
   - Continua sendo **um único** follow-up, dentro de 08h–19h BRT e da janela de 24h da Meta.

4. **Coerência no atendimento normal**
   - Reforçar nas instruções do IAGO que ele nunca deve mencionar "proposta que te mandei" se nenhum valor foi enviado antes na conversa.

## Detalhes técnicos

- `supabase/functions/iago-atendimento/index.ts`: gravar `contexto.proposta_enviada` quando `proposta` existe e as mensagens enviadas contêm valores; manter etapa atual.
- `supabase/functions/iago-followup-tick/index.ts`: carregar as últimas ~12 mensagens da conversa; escolher entre texto configurado (com proposta) e texto gerado pela IA com histórico (sem proposta); aplicar o mesmo filtro de similaridade já usado no atendimento; abortar o envio quando nada novo restar.
- Sem novo cron, polling ou tabela — usa o mesmo tick existente e apenas uma leitura extra de mensagens por conversa pendente (custo desprezível).

## Validação

- Simular conversa sem proposta e confirmar que o follow-up não fala de proposta.
- Simular conversa com proposta enviada e confirmar a retomada normal.
- Conferir nos logs do follow-up os casos cancelados por repetição.

# IAGO: cliente falecido encerra a conversa (sem follow-up)

## O que acontece hoje (confirmado no código)

- O IAGO já tem uma trava para "número errado / não sou essa pessoa" (`ehNumeroErrado`): ele encerra, marca "Aguardando Humano" e cancela o follow-up.
- Não existe nenhuma detecção de **falecimento**. Por isso, no caso da imagem, ele respondeu as condolências corretamente, mas o `iago-followup-tick` seguiu com o agendamento e enviou "conseguiu ver a proposta que te mandei" às 17:30.

## O que será feito

1. **Detectar aviso de falecimento**
   - Reconhecer frases como "faleceu", "é falecido/falecida", "morreu", "óbito", "veio a óbito", "descansou em 2022", "já não está mais entre nós", inclusive com o nome antes ("D Eucaristia faleceu 2022"), sem acento e com erros de digitação simples.

2. **Encerrar a conversa de forma respeitosa**
   - Enviar uma única mensagem de condolências e encerramento (sem valores, sem CPF, sem cobrança).
   - Se o IAGO já tiver enviado condolências naquela conversa, não repete nada — só encerra.
   - Marcar a conversa como encerrada por falecimento, aplicar a etiqueta "Aguardando Humano" e qualificar a conversa (falecido / não é o cliente) para o time tratar manualmente.

3. **Nunca fazer follow-up nesse caso**
   - Cancelar o agendamento na hora (`followup_em` nulo, follow-up concluído).
   - No `iago-followup-tick`, fazer a mesma dupla checagem que já existe para número errado: antes de qualquer envio, reler o histórico de entrada; se houver aviso de falecimento, cancelar o follow-up definitivamente e não enviar nada.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: nova função `ehFalecido(texto)` (mesma normalização usada por `ehNumeroErrado`) + constante de mensagem de condolências/encerramento.
- `supabase/functions/iago-atendimento/index.ts`: novo bloco logo após o de número errado — envia condolências (se ainda não enviadas), grava `etapa='falecido'`, `aguardando_humano=true`, `followup_feito=true`, `followup_em=null`, aplica etiqueta e qualifica.
- `supabase/functions/iago-followup-tick/index.ts`: incluir `ehFalecido` na checagem de histórico já existente e abortar o envio.
- Sem cron novo, sem polling, sem tabela nova — custo zero adicional.

## Validação

- Reprocessar/simular a conversa da Gracietearaujo124: o follow-up deve ser cancelado e nada mais enviado.
- Simular "meu pai faleceu" numa conversa nova: uma resposta de condolências, etiqueta "Aguardando Humano" e nenhum follow-up depois.

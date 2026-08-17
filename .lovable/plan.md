# IAGO: número errado nunca gera follow-up

No caso da conversa do print, o cliente respondeu "Não sou Sebastiao". O IAGO respondeu encerrando, mas ainda assim mandou o follow-up 2h depois ("Só passando pra saber se você conseguiu ver a proposta...").

## Causa confirmada

A detecção de número errado (`ehNumeroErrado` em `supabase/functions/_shared/iago.ts`) só reconhece frases com artigo/pronome depois de "não sou" — "não sou o Sebastião", "não sou eu". Uma resposta com o nome direto ("Não sou Sebastiao") não é reconhecida. Sem essa detecção, o estado da conversa não é marcado como `numero_errado`, o follow-up fica agendado e é disparado normalmente pelo `iago-followup-tick`.

## O que muda

1. Reconhecimento mais amplo de negação de identidade: passa a cobrir "não sou <nome>", "não é <nome>", "aqui não é o/a <nome>", "quem fala não é...", além dos casos que já funcionam (número errado, engano, pessoa errada, não conheço).
2. Trava de segurança no follow-up: antes de enviar qualquer toque (etapas 1, 2 ou 3), o sistema lê as últimas mensagens do cliente daquela conversa; se alguma delas for negação de identidade, o follow-up é cancelado de forma definitiva e a conversa é marcada como encerrada para o IAGO (com a etiqueta "Aguardando Humano"), sem enviar mensagem.

Assim, mesmo que uma frase nova escape do reconhecimento no momento do atendimento, ela nunca resulta em follow-up.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: ampliar a regex de `ehNumeroErrado` para aceitar "nao sou/nao e" seguido de nome próprio (palavra capitalizada ou qualquer palavra que não seja verbo de continuação), "aqui nao e", "quem fala nao e", mantendo os padrões atuais; manter normalização de acentos.
- `supabase/functions/iago-followup-tick/index.ts`: no loop de candidatos, após carregar o histórico (`msgs`), verificar as mensagens de `direcao='entrada'` com `ehNumeroErrado`. Se positivo: `update` em `iago_conversa_estado` com `followup_feito=true`, `followup_em=null`, `followup_etapa=3`, `aguardando_humano=true`, `etapa='numero_errado'`, aplicar a etiqueta "Aguardando Humano" e `continue` (nada enviado).
- Sem migração, sem cron novo, sem chamada extra de IA — a checagem é local e reduz envios/custo.

# Etiqueta "ACORDO FECHADO" quando o IAGO fecha negociação

## O que muda
Quando o IAGO conclui a negociação (o cliente escolhe a forma de pagamento — à vista ou parcelado — e confirma a data de pagamento), a conversa passa a receber automaticamente a etiqueta já existente **ACORDO FECHADO**, além da etiqueta "Aguardando Humano" que ela já recebe hoje.

## Quando a etiqueta é aplicada
- Cliente escolheu a opção E vai pagar hoje → etiqueta aplicada.
- Cliente escolheu a opção E informou uma data dentro do mês atual → etiqueta aplicada.
- Cliente informou data fora do mês atual, ou não definiu data, ou escalou por dúvida/número errado/já possui acordo → **não** aplica a etiqueta (continua só o alerta para humano).

A etiqueta permanece na conversa e some apenas se removida manualmente no Inbox, seguindo as regras atuais de etiquetas.

## Detalhes técnicos
- `supabase/functions/_shared/iago.ts`: nova constante `ETIQUETA_ACORDO_FECHADO = 'ACORDO FECHADO'` e função `etiquetarAcordoFechado(supabase, contatoId)` que busca a etiqueta existente por nome (ilike, sem criar nova) e faz upsert em `meta_whatsapp_contato_etiquetas` com `onConflict: 'contato_id,etiqueta_id'` e `ignoreDuplicates`. Se a etiqueta não existir, apenas registra log e segue.
- `supabase/functions/iago-atendimento/index.ts`: dentro do bloco `if (escalar)`, aplicar a nova etiqueta quando `escolha` existir e `dataAcordada` for `hoje` ou uma data dentro do mês (usando o resultado já calculado de `classificarDataPagamento`, guardado numa flag `acordoFechado`).
- Deploy da função `iago-atendimento` após a alteração.
- Sem mudança de schema nem de UI: a etiqueta já cadastrada aparece normalmente no card da conversa.

# IAGO: confirmar a data do pagamento antes de chamar o atendente

Hoje, assim que o cliente escolhe à vista ou o parcelamento, o IAGO já encerra ("vou te transferir para um especialista") e chama o humano. Passa a existir um passo intermediário de confirmação da data.

## Novo fluxo depois da escolha

1. Cliente escolhe a forma (ex.: "24 parcelas de 100", "à vista").
   - IAGO confirma a escolha e pergunta: *"Consegue realizar o pagamento hoje?"* — sem transferir ainda.
2. Cliente responde **sim / hoje** → IAGO confirma e chama o atendente (como hoje), informando a opção escolhida e "pagamento hoje".
3. Cliente responde **não / não dá hoje** → IAGO pergunta: *"Que dia você consegue realizar o pagamento?"*
4. Cliente informa a data:
   - **Data dentro do mês atual** → IAGO confirma a data e chama o atendente, com a opção e a data no aviso.
   - **"mês que vem", "dia 5 do mês que vem", ou qualquer data fora do mês atual** → IAGO não negocia prazo: manda uma mensagem curta dizendo que um colega vai continuar e chama o atendente, com o motivo "data de pagamento fora do mês".
   - Resposta vaga ("não sei", "depois") → IAGO pergunta uma única vez de forma diferente; se continuar vago, chama o atendente.

O cliente que responde com data já na própria escolha (ex.: "24x, pago dia 20") não é perguntado de novo: se a data está no mês, confirma e escala; se está fora, escala com o motivo de data fora do mês.

Regras que continuam valendo: IAGO nunca lança acordo, nunca se identifica como IA, follow-up único, opt-out e número errado sem alteração.

## Detalhes técnicos

`supabase/functions/iago-atendimento/index.ts`:

- Novas etapas no estado (`iago_conversa_estado.etapa` + `contexto`): `escolha_feita` (aguardando resposta de "hoje?") e `aguardando_data` (aguardando o dia). Guardar no `contexto` a opção escolhida (`opcao_escolhida`) e a data informada (`data_pagamento`).
- Reconhecimento da escolha e da resposta feito pela própria IA, que passa a devolver campos extras no JSON: `escolha` (texto da opção), `pagamento_hoje` (sim/não/indefinido) e `data_pagamento` (ISO ou texto tipo "mes_que_vem"). Fallback por palavra-chave (números + "x", "à vista", "sim/hoje", "não", nomes de meses, "mês que vem", "dia N") para o caso de a IA não preencher.
- Novo helper de data em `_shared/iago.ts`: interpreta "dia 20", "20/08", "próxima semana", "mês que vem" em relação ao horário de São Paulo e classifica em `dentro_do_mes` / `fora_do_mes` / `indefinido`.
- `escalar` deixa de ser disparado só pela aceitação: passa a ocorrer quando a data está confirmada (dentro do mês), quando está fora do mês, quando o cliente não define a data após uma repergunta, ou nos casos atuais (assunto proibido, dúvida, já tem acordo).
- Prompt (`gerarResposta`): substituir a regra "quando o cliente aceitar uma opção, escale" pela sequência escolha → "consegue pagar hoje?" → (se não) "que dia consegue?" → escalar; deixando explícito que data fora do mês atual escala imediatamente sem prometer prazo.
- Aviso ao humano (`avisarEmergencia`): incluir a opção escolhida e a data combinada / "fora do mês" no texto que vai para o WhatsApp e para o sino de negociações do IAGO.
- O follow-up único continua sendo cancelado quando escala; durante as etapas `escolha_feita` / `aguardando_data`, se o cliente não responder, vale o follow-up normal já existente.

Sem novas tabelas, sem cron novo, sem custo adicional de infraestrutura (mesma chamada de IA por mensagem recebida).

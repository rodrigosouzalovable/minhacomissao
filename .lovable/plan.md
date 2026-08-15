# IAGO — Follow-ups em 3 momentos da janela de 24h

Hoje o IAGO faz **um único** follow-up (padrão 2h após o envio, se o cliente não respondeu) e depois marca a conversa como "follow-up feito" para sempre. A ideia é passar a ter até **3 tentativas** de retomada dentro da mesma janela de 24h, cada uma com mensagem diferente.

## Como vai funcionar

Contagem sempre a partir da **última mensagem do cliente** (que é o que abre a janela de 24h da Meta):

| Etapa | Quando | Estilo da mensagem |
|---|---|---|
| 1 | ~2h após o envio do IAGO (mantém a config atual) | Retomada leve: "viu a proposta?" / retoma o pedido do CPF |
| 2 | 12h de janela aberta | Reforço com utilidade: lembra o benefício (desconto/condição) e pergunta o que ele achou |
| 3 | 23h de janela aberta (1h antes de fechar) | Última chamada: avisa que a condição/atendimento pode não continuar disponível e pede um retorno rápido |

Regras que valem para as três etapas:

- Se o cliente responder qualquer coisa, todas as etapas pendentes são canceladas.
- Nada é enviado se a conversa saiu do IAGO, se está aguardando humano, se houve opt-out, ou se a janela de 24h fechou.
- Continua respeitando o horário permitido (padrão 08h–19h BRT). Se o marco de 12h ou 23h cair fora desse horário, a mensagem sai no primeiro horário permitido seguinte — e, no caso da etapa 3, na última passagem possível antes de a janela fechar, para não perder a chance.
- Nunca repete um texto igual/parecido com algo já enviado na conversa (regra que já existe é mantida e passa a considerar também os follow-ups anteriores).
- Cada etapa tem prompt próprio, então o texto é sempre diferente e coerente com o histórico: só fala de proposta/valores se valores realmente já foram enviados.

## Configuração (aba Follow-up do IAGO)

- Mantém "ativo", "horas do 1º follow-up", horário permitido e o texto base.
- Passa a ter liga/desliga independente para o follow-up de 12h e o de 23h, e as horas de cada um ficam ajustáveis (padrão 12 e 23).

## Detalhes técnicos

1. **Banco**: adicionar em `iago_conversa_estado` a coluna `followup_etapa` (smallint, default 0) para registrar até qual etapa já foi enviada; `followup_feito`/`followup_em` continuam controlando a etapa 1. Adicionar em `iago_config`: `followup2_ativo`, `followup2_horas` (12), `followup3_ativo`, `followup3_horas` (23).
2. **`iago-followup-tick`**: além dos candidatos por `followup_em` (etapa 1), passa a buscar conversas do IAGO com janela aberta e `followup_etapa < 3`, calculando o marco de 12h/23h sobre `meta_whatsapp_contatos.ultima_msg_entrada_em`. Envio só quando não houve entrada do cliente após o último envio nosso.
3. **Geração de texto**: a função de texto passa a receber a etapa e usar instruções diferentes por etapa (tom crescente de urgência, sem soar agressivo), reaproveitando a checagem anti-repetição já existente.
4. **`iago-atendimento`**: ao responder o cliente, zera `followup_etapa` e reprograma a etapa 1, já que a janela reabriu.
5. **Cron**: o job atual roda a cada 15 min entre 08h–19h BRT — suficiente para as três etapas; sem novo agendamento e sem custo adicional.

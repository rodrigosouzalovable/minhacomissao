# IAGO: silêncio quando não sabe e respeito ao atendente humano

Duas correções no comportamento do IAGO (inclusive dentro do plantão 17h–08h e fins de semana).

## 1. Não responder o que ele não sabe

Hoje, quando o IAGO escala para "Aguardando Humano" por não saber a resposta, ele ainda envia o texto que a IA gerou — foi o que aconteceu com "Quanto de prazo você me dá para mim conseguir esse dinheiro?".

Passa a funcionar assim:

- Dúvida fora do que foi ensinado / assunto proibido / insegurança na resposta: o IAGO **não envia nada**. Só aplica a etiqueta "Aguardando Humano", marca a conversa e avisa você no WhatsApp e no sino "Negociações do IAGO".
- Continua enviando normalmente nos fluxos em que a mensagem é necessária: proposta de valores, pergunta "consegue pagar hoje?", pergunta da data de pagamento, encerramento de número errado.
- Quando o cliente fecha a negociação (escolha + data), ele envia a confirmação final e aí escala — isso não muda.

## 2. Atendente humano respondeu = IAGO calado por 10 minutos

- Se um atendente humano respondeu a conversa, o IAGO fica em silêncio ali, mesmo dentro do plantão.
- Se o cliente mandar nova mensagem e já passaram **mais de 10 minutos** desde a última resposta humana, sem nova interação humana, o IAGO volta a atender normalmente.
- Antes dos 10 minutos ele apenas registra a mensagem e não responde — evita duas respostas diferentes na mesma conversa.
- Vale também para as conversas antigas que o IAGO assume no plantão: a transferência não apaga mais o "humano acabou de responder"; ele respeita a janela de 10 minutos.

## Detalhes técnicos

`supabase/functions/iago-atendimento/index.ts`:
- Bloco "Humano assumiu?": em vez de marcar `aguardando_humano` de forma definitiva, calcular a saída humana mais recente. Se `agora - criado_em < 10 min`, sair sem responder (sem travar o estado). Se ≥ 10 min e o cliente voltou a falar depois dessa saída humana, seguir o atendimento (atualizando `contexto.ultimo_envio_ia` para o horário da saída humana, para não reprocessar).
- Bloco do plantão (linhas ~98–126): manter o reset de `aguardando_humano`, mas não sobrescrever o corte com `assumido_em` de forma a ignorar mensagens humanas recentes — o corte passa a ser o maior entre `assumido_em` e a última saída humana, ainda sujeito à regra dos 10 minutos.
- Escalada por desconhecimento: quando `escalar` vier da IA (`resultado.escalar`) e não de um fluxo de escolha/data, zerar `mensagens` antes do loop de envio, mantendo etiqueta, estado, `followup_em: null` e `avisarEmergencia`.

Sem novas tabelas, crons ou polling — custo inalterado.

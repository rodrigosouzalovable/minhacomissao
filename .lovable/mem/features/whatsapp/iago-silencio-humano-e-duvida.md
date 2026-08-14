---
name: IAGO — silêncio por dúvida e janela de 10 min do humano
description: IAGO não envia mensagem quando escala por dúvida, e fica calado 10 minutos após resposta de atendente humano (inclusive no plantão)
type: feature
---

- Escalada por dúvida (`resultado.escalar` da IA, sem escolha de pagamento): o IAGO **não envia nenhuma mensagem**. Aplica etiqueta "Aguardando Humano", grava `aguardando_humano=true` e avisa os contatos de emergência.
- Fluxos que continuam enviando: proposta, "consegue pagar hoje?", "que dia consegue pagar?", encerramento de número errado, confirmação final antes de escalar.
- Resposta de atendente humano na conversa: IAGO calado por **10 minutos**. Se o cliente voltar a falar depois de 10 min sem interação humana, o IAGO retoma (corte passa a ser a última saída humana). Antes dos 10 min ele só registra e sai.
- O plantão não apaga mais o corte (`ultimo_envio_ia`) ao assumir conversa antiga — a regra dos 10 minutos vale também no plantão.

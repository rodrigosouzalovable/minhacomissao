# IAGO: responder pendências e tratar números UAZAPI inválidos

## Diagnóstico confirmado

- As conversas da caixa **AQUECIMENTO** estão ligadas a instâncias com `provider = uazapi`, então o problema não é a instância estar fora da UAZAPI.
- O erro mostrado vem do envio para o **número do cliente/destinatário**: `5515553487840@s.whatsapp.net is not on WhatsApp`.
- Ou seja: a instância conectada tentou responder, mas a UAZAPI informou que o destinatário `+55 (15) 55348-7840` não é uma conta válida/ativa de WhatsApp para receber mensagem.
- Esse número também veio repetido em várias instâncias com a mesma mensagem automática da “Lisboa e Lima Comercio”, o que parece envio em massa/robô para os chips.
- Hoje existem conversas recentes onde a última mensagem é de entrada e não há uma saída posterior registrada; parte delas deve ser reprocessada pelo IAGO, mas destinos que a UAZAPI já marca como “não está no WhatsApp” não devem ficar gerando novas tentativas infinitas.

## O que será feito

1. **Reprocessar conversas sem resposta do IAGO**
   - Criar uma execução pontual para chamar o IAGO novamente nas conversas onde a última mensagem é do cliente e não existe resposta posterior.
   - Priorizar a caixa **AQUECIMENTO** e conversas atribuídas ao IAGO.
   - Ignorar conversas já encerradas, em opt-out, aguardando humano por motivo real, número errado ou falecimento.

2. **Não insistir em número que não existe no WhatsApp**
   - Quando a UAZAPI retornar “not on WhatsApp”, o sistema vai registrar essa falha na conversa.
   - A conversa será marcada para revisão humana ou qualificação de número inválido, em vez de o IAGO tentar responder de novo sem parar.

3. **Corrigir o status visual da tentativa**
   - A mensagem que falhar no envio continuará aparecendo com erro, mas o estado do IAGO será liberado corretamente.
   - Isso evita conversa travada e evita que o usuário ache que a instância desconectou quando, na verdade, o destinatário foi recusado pela UAZAPI.

4. **Resposta automática só para contatos realmente enviáveis**
   - O reprocessamento vai chamar o IAGO apenas para conversas onde a resposta tem chance de sair.
   - Mensagens de divulgação em massa/robô, como a da imagem, ficarão sem resposta automática e sinalizadas para revisão, para não gastar IA nem gerar erro de envio.

## Detalhes técnicos

- Usar `meta_whatsapp_contatos` + `meta_whatsapp_mensagens` para localizar conversas cuja última mensagem é `entrada` e a última `saida` é anterior ou inexistente.
- Para cada conversa elegível, chamar a função `iago-atendimento` com `contato_id`, `entrada_id` e o texto da última entrada.
- Em `send-whatsapp-meta-text`, no fluxo `provider = uazapi`, tratar o erro `not on WhatsApp` como falha conhecida:
  - gravar uma mensagem/estado com erro legível;
  - liberar a trava do IAGO;
  - impedir retry automático para o mesmo destino inválido.
- Manter a regra existente: mensagens claras de divulgação em massa não recebem atendimento automático.

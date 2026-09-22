# IAGO sempre ativo e com respostas variadas na caixa AQUECIMENTO

## Diagnóstico confirmado
- A mensagem **“OI”** chegou corretamente pela instância **TESTE 1 555-482-5731**, foi salva na caixa **AQUECIMENTO** e recebeu a etiqueta **Atendente: Iago Ribeiro de Souza**.
- O IAGO está ativo e cadastrado como responsável dessa caixa.
- A resposta foi bloqueada porque o mesmo telefone aparece em outra conversa com um atendente humano. A exceção atual da caixa AQUECIMENTO ignora esse vínculo somente para instâncias UAZAPI; ela ainda não contempla a nova origem **Teste Meta**.

## Correção
1. Tratar toda conversa da caixa AQUECIMENTO com origem `meta_teste` como independente das outras caixas.
   - Um atendente humano vinculado ao mesmo telefone em outra conversa não silenciará o IAGO no aquecimento.
   - Etiquetas humanas antigas de outras caixas não serão copiadas nem usadas para bloquear essa conversa.
   - A conversa continuará fixa na caixa AQUECIMENTO e atribuída ao IAGO.

2. Garantir resposta em toda nova mensagem válida nessa caixa.
   - Texto e mídias compreendidas receberão resposta.
   - Áudio sem transcrição, imagem ilegível e conteúdo sem texto terão uma resposta curta pedindo que a pessoa explique por mensagem.
   - O IAGO nunca transferirá essas conversas para humano nem aplicará “Aguardando Humano”.
   - Reentregas duplicadas do mesmo evento continuarão deduplicadas, evitando respostas repetidas para uma única mensagem.

3. Criar um estilo exclusivo e variado para AQUECIMENTO.
   - Usar o histórico recente para não repetir abertura, frase, pergunta ou estrutura já usada.
   - Alternar naturalmente entre comentários, perguntas leves, concordâncias e mudanças suaves de assunto.
   - Manter mensagens curtas, informais e coerentes com o que a pessoa disse, sem parecer roteiro de cobrança.
   - Evitar repetir nome, emojis, saudações e perguntas em mensagens consecutivas.
   - Se a geração falhar, usar respostas alternativas rotativas que também excluem as últimas frases enviadas.

4. Isolar esse comportamento.
   - A variação humana será aplicada somente à caixa AQUECIMENTO.
   - As caixas de cobrança, Certificado Digital e demais atendimentos manterão as regras atuais.
   - Instâncias Teste Meta continuarão fora de campanhas, cobrança, recuperação e evolução de tier.

## Validação
- Reprocessar uma nova mensagem na conversa do número **(62) 9167-2674** e confirmar resposta enviada pela instância TESTE 1.
- Enviar mensagens consecutivas e conferir que todas recebem respostas contextualizadas e diferentes.
- Confirmar que uma etiqueta humana em outra caixa não interrompe o IAGO no AQUECIMENTO.
- Conferir mensagens de texto e uma mídia sem leitura, além dos registros de recebimento e envio.

## Detalhes técnicos
- Ajustar a proteção de atendente humano para liberar `folder_id = AQUECIMENTO` quando `origem_aquecimento = meta_teste`, assim como já ocorre com UAZAPI.
- Dar precedência explícita ao modo AQUECIMENTO antes da validação geral de caixa/atendente, mantendo a exigência da etiqueta IAGO na própria conversa.
- Reforçar o prompt exclusivo do modo AQUECIMENTO com histórico antirrepetição e validar a resposta contra as saídas recentes antes do envio.
- Publicar e testar `iago-atendimento` e, se necessário para impedir atribuição concorrente, `meta-whatsapp-webhook`.

## Custo
Não haverá nova rotina, cron ou consulta contínua. O custo por mensagem permanece semelhante ao atendimento atual; apenas as mensagens antes ignoradas nessa caixa passarão a receber resposta.

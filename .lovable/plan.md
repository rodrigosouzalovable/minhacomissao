# Ajustar “Não precisa de resposta” no Inbox Meta Oficial

## Resultado esperado
- Abrir e sair de uma conversa sem responder continuará mantendo o card como não lido.
- Ao clicar com o botão direito no card e escolher **“Não precisa de resposta”**, o indicador e a contagem de não lidas desaparecerão imediatamente.
- Uma nova mensagem do cliente voltará a marcar a conversa como não lida normalmente.
- Ao escolher **“Voltar a exigir resposta”**, o indicador reaparecerá quando a última mensagem do cliente ainda estiver sem uma resposta posterior.

## Implementação
- Atualizar a ação existente do menu para gravar em conjunto a dispensa de resposta e o estado `nao_lido` da conversa.
- Sincronizar a alteração no card e na conversa aberta, revertendo a tela caso a gravação falhe.
- Manter o comportamento atual em que somente uma saída bem-sucedida posterior à entrada encerra a pendência, além da nova dispensa manual explícita.
- Não alterar arquivamento, etiquetas, distribuição de atendentes ou regras do IAGO.

## Validação
- Conferir o fluxo: abrir conversa não respondida, sair e confirmar que permanece não lida.
- Usar o clique direito e confirmar que “Não precisa de resposta” remove o indicador.
- Simular nova entrada e confirmar que o não lido retorna.
- Conferir “Voltar a exigir resposta” e possíveis erros de gravação.

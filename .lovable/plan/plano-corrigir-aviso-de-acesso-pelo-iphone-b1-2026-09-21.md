# Plano — Corrigir aviso de acesso pelo iPhone B1

## Diagnóstico confirmado
- A permissão **Notificar quando acessar o sistema** está salva e ativa para Alexander Magalhães.
- O telefone pessoal de destino está configurado.
- A instância **iPhone B1 — (62) 8181-0202** está ativa e marcada para notificações.
- Nenhum acesso do Alexander foi registrado na fila nem no histórico de notificações; portanto, a falha acontece antes do envio pelo WhatsApp.
- O aviso atual é disparado assim que o usuário aparece na tela, mas sem vincular explicitamente a sessão autenticada à chamada. Isso permite que a chamada aconteça antes de a sessão estar pronta e falhe sem nova tentativa.
- Há duas instâncias marcadas ao mesmo tempo: **iPhone B1** e **THIAGO 2 B1**. O controle atual não torna a escolha exclusiva, apesar de a tela indicar um número responsável.

## Correções
- Disparar o aviso somente depois que a sessão autenticada estiver disponível, enviando explicitamente a identificação segura dessa sessão.
- Aguardar a resposta do registro do acesso e registrar claramente qualquer falha, em vez de considerar o evento concluído antes da confirmação.
- Manter um único disparo por abertura/recarga autenticada, sem polling e sem consultas repetitivas.
- Fazer a seleção de **Notificações pessoais** ser exclusiva: ao ativar uma instância, desativar automaticamente as demais.
- Sincronizar a configuração principal para apontar para a instância escolhida; neste caso, **iPhone B1**.
- Preservar o intervalo aleatório já existente de 30 a 60 segundos entre mensagens.
- Fortalecer o despertar da fila para que a função de acesso só confirme sucesso depois que o aviso estiver realmente registrado e o processador tiver sido acionado.

## Segurança e custo
- A identidade do usuário será obtida exclusivamente da sessão autenticada; o navegador não poderá informar quem acessou.
- Não será criado cron, polling ou novo processo recorrente.
- Não haverá aumento permanente de consultas; será corrigido apenas o disparo único já previsto em cada acesso.

## Validação
- Entrar como Alexander e confirmar uma linha `acesso_usuario` na fila.
- Aguardar o intervalo configurado e confirmar o envio para o WhatsApp pessoal.
- Confirmar no histórico que a mensagem saiu pela instância **iPhone B1**.
- Recarregar uma vez e confirmar um novo aviso; mudanças internas de sessão na mesma abertura não poderão duplicá-lo.
- Desativar a permissão e confirmar que um novo acesso não gera aviso.
- Confirmar que somente uma instância pode permanecer responsável pelas notificações pessoais.

# Conferir e recuperar o webhook antes de avisar no WhatsApp

## O que foi confirmado

O aviso da SOUZA 62 8275-5977 foi enviado às 15h30 (Brasília) após uma consulta à Meta expirar; às 15h31 a instância já constava como reinscrita e sem erro. A verificação roda a cada 30 minutos. Hoje, se a primeira consulta falhar, o resultado vira “erro” e pode gerar mensagem imediatamente, sem uma segunda confirmação. O sistema já tenta reinscrever quando consegue consultar a Meta e encontra inscrição ausente ou incorreta; o botão Webhook executa a reinscrição manualmente.

## Alteração proposta

1. **Confirmar antes de alertar:** quando a consulta à Meta expirar ou falhar transitoriamente, não tratar a primeira falha como prova de que o webhook caiu. Fazer uma nova consulta curta, restrita à instância afetada, e conferir a inscrição e o endereço exato do webhook. Se a falha for temporária, registrar a verificação inconclusiva sem enviar WhatsApp nem afirmar que mensagens deixaram de chegar.
2. **Tentar recuperar automaticamente:** se a inscrição estiver ausente ou apontando para outro endereço, reinscrever usando o token correto daquela instância (inclusive parceiro), conferir novamente na Meta e só marcar como recuperada depois da confirmação. Não reinscrever uma inscrição já correta só por timeout; se a própria confirmação estiver indisponível, manter o caso como inconclusivo.
3. **Avisar apenas quando houver problema confirmado:** enviar aviso ao WhatsApp somente se a inscrição continuar incorreta/ausente após a tentativa de reparo, ou se a Meta retornar um erro persistente que impeça a recuperação. Indicar o motivo real e o que fazer. Recuperações bem-sucedidas e falhas passageiras ficam visíveis na tela, sem mensagem repetitiva no WhatsApp. Preservar a detecção separada de possível perda de mensagens, mas evitar repetir uma suspeita antiga depois de uma reinscrição bem-sucedida; não afirmar que mensagens anteriores foram entregues sem evidência.
4. **Validar:** simular timeout seguido de sucesso, inscrição incorreta seguida de reparo confirmado, falha persistente e reinscrição manual. Conferir que somente falhas confirmadas geram aviso e que o estado mostrado na instância corresponde à última checagem.

## Detalhes técnicos

Ajustar `meta-webhook-health` para distinguir `ok`, `reinscrito`, `erro confirmado` e `verificação inconclusiva`, usar comparação exata da URL do callback entre as inscrições retornadas, conferir `response.ok`, fazer retry limitado só em erros transitórios e verificar o resultado do POST com novo GET. Alinhar o estado registrado pelo botão Webhook em `ConfigurarMeta` com essa confirmação. Manter o agendamento existente, sem novo cron, polling ou canal em tempo real; preservar a separação de permissões por instância.

**⚠️ ALERTA DE CUSTO LOVABLE CLOUD:** haverá até uma consulta extra à Meta nas verificações que falharem e uma consulta de confirmação após reparos, somente para instâncias afetadas. Não haverá consulta contínua nova nem aumento da frequência de 30 minutos; o impacto esperado na Cloud é pequeno, mas depende de quantas instâncias falharem. A aprovação deste plano autoriza esse custo pontual.

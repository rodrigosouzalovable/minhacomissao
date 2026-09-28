# Templates automáticos por proprietário

## Objetivo
Impedir que modelos de outros usuários sejam aplicados às suas instâncias e permitir marcar cada modelo próprio para presença automática em todas as suas instâncias elegíveis.

## Implementação
- Filtrar a lista e as ações de modelos pelo usuário que criou/importou o modelo, mantendo acesso administrativo sem misturar proprietários.
- Trocar “Modelos para números novos” por uma marcação clara de aplicação automática nas próprias instâncias.
- Fazer a auditoria existente cruzar o proprietário do modelo com o proprietário da instância.
- Considerar somente instâncias Meta ativas, conectadas e GREEN; quando voltarem a GREEN, os modelos próprios ausentes entram na fila.
- Bloquear modelos sem proprietário na automação e impedir submissão cruzada entre usuários.
- Reutilizar a verificação diária e o processamento atuais, sem novo agendamento, polling ou rotina adicional.

## Validação
- Confirmar que um modelo do Thiago não entra nas instâncias do solicitante.
- Confirmar que um modelo próprio marcado entra nas instâncias próprias GREEN onde estiver ausente.
- Confirmar que instâncias YELLOW/RED permanecem aguardando e são reconsideradas ao voltar para GREEN.
- Validar a tela, permissões e o processamento automático sem erros.

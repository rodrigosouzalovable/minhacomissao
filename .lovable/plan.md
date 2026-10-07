# Reativar instância com qualidade baixa pelo Inbox Meta

## Alteração

- Mostrar **Reativar no pool** junto ao aviso da instância na conversa quando ela estiver YELLOW ou RED e fora do pool por qualidade.
- Manter as permissões escolhidas: **administradores** e **Parceiros Meta somente nas próprias instâncias**. Atendentes comuns não recebem essa permissão.
- Antes de executar, mostrar o número, a qualidade atual e uma confirmação de risco. Reativar não muda a qualidade na Meta e não garante que ela aceitará os envios.
- Consultar a saúde dessa instância na Meta antes da tentativa. Se houver bloqueio real, limitação de envio confirmada ou consulta inconclusiva, informar o motivo e não executar a reativação.
- Durante a tentativa, impedir cliques repetidos. Após sucesso, atualizar o aviso e o estado da instância no Inbox; em caso de recusa, manter o estado e explicar o próximo passo.

## Limites

- Não iniciar campanha nem enviar mensagens automaticamente ao reativar.
- Não alterar a recuperação automática, as regras de campanha, os limites de envio ou as permissões de outras telas.
- Não tratar qualidade baixa, isoladamente, como banimento; bloqueios reais da Meta continuam respeitados.
- Instâncias retiradas manualmente ficam fora dessa nova ação específica de recuperação por qualidade.

## Detalhes técnicos

- O Inbox já exibe `MetaInstanceHealthBanner`, mas esse aviso não oferece ação de reativação.
- Reutilizar a operação autenticada `ativar_meta_instancia_pool`, que valida administrador ou parceiro vinculado à instância, e a consulta individual de `check-meta-instance-health`.
- Acrescentar a ação ao aviso e integrar confirmação, carregamento e atualização em `InboxMeta.tsx`, sem ampliar permissões.
- Validar a resposta da consulta antes de chamar a reativação; uma falha não será interpretada como liberação.
- Sem novos agendamentos, consultas periódicas ou canais em tempo real. Apenas uma consulta individual ao clicar, com impacto pontual mínimo de custo.

## Validação

- Conferir YELLOW e RED fora do pool, confirmação e cancelamento, atualização após sucesso e mensagem de recusa.
- Conferir que instâncias GREEN/ativas não exibem essa ação e que atendentes sem permissão não podem utilizá-la.
- Testar as regras de elegibilidade e recusa sem disparar mensagens nem reativar números reais durante os testes.
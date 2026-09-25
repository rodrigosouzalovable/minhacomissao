# Liberar cadastro e submissão de templates MARKETING à Meta

## Resultado esperado
- Na área Templates Meta, permitir criar modelos MARKETING e enviá-los para aprovação, primeiro em uma instância piloto e depois nas demais instâncias escolhidas após aprovação.
- Mostrar claramente que aprovação de template não é autorização para disparar mensagens; a trava de custo para envios MARKETING permanece ativa.

## Escopo
- Ajustar a validação da submissão em lote para aceitar MARKETING, mantendo exemplos obrigatórios, checagens de conteúdo, seleção de instâncias, aprovação do piloto e limite de dois templates/dia nas contas tier 250.
- Manter AUTHENTICATION fora desse fluxo, bem como as exclusões específicas de aquecimento, onboarding automático e campanhas em massa. Não alterar a configuração atual que bloqueia envios de mensagens MARKETING nem iniciar envios.
- Atualizar o texto de orientação da área de templates para diferenciar submissão à Meta de disparo a clientes; indicar quando o modelo estiver reclassificado pela Meta.

## Detalhes técnicos e validação
- Em `meta-criar-template-lote`, aceitar somente UTILITY ou MARKETING e impedir que `ignorar_validacao` contorne a checagem da categoria. Preservar a categoria enviada no pedido à Meta e os registros de status/rejeição por instância.
- Conferir os fluxos piloto, replicação, falhas e tier 250; confirmar que o bloqueio de custos e os filtros de UTILITY em Nova Conversa e automações continuam intactos. Validar sem submeter templates reais nem enviar mensagens.

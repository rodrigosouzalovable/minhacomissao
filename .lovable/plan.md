# Notificações no horário certo e reativação de todas

## O que encontrei
- A fila de avisos para o seu WhatsApp está com cerca de 1.500 avisos acumulados desde 16/10 (800 aguardando e ~700 travados "em processamento").
- Causa: quando você limitou os tipos de aviso na semana passada, os avisos dos tipos desligados deveriam ser descartados, mas o registro "pausado" é recusado pelo sistema. Eles ficam travados e o processador gasta o intervalo de 30–60 segundos com cada um antes de chegar aos avisos permitidos.
- Por isso o ponto de entrada de 21/10 só chegou hoje: ele estava atrás de centenas de avisos na fila.

## O que será feito
1. Corrigir o descarte para que avisos pausados nunca mais fiquem travados.
2. Limpar o acúmulo: avisos com mais de 2 horas de atraso são descartados (ficam no histórico como "expirado") em vez de chegarem velhos ao seu WhatsApp.
3. Daqui em diante, qualquer aviso que ficar mais de 2 horas na fila é descartado automaticamente, para você nunca mais receber ponto ou alerta de outro dia.
4. Reativar todos os tipos de aviso que você tinha desligado (saúde das instâncias, campanhas, IAGO, cobrança Meta, templates, relatórios, ponto etc.). A instância Âncora 9590 continua no rodízio.

## Atenção ao volume
Com tudo reativado, entram muitos avisos por dia (só "instância recolocada" teve 300+ em dois dias). Com o intervalo de 30–60 segundos, isso pode voltar a gerar fila. Se quiser, depois desligo só os mais repetitivos.

## Detalhes técnicos
- Migração: incluir `pausado` e `expirado` no check de `admin_notificacoes_fila.status`; marcar `expirado` todos os itens `pendente`/`processando` com `criada_em < now() - 2h`; limpar `fila_processando_id/ate` da config; `tipos_permitidos = NULL`, `notificacoes_pausadas = false`.
- `process-admin-notification-queue`: ao reivindicar item com mais de 2h, finalizar como `expirado` sem envio e sem aplicar o intervalo; seguir para o próximo.
- Sem novo cron, polling ou canal em tempo real — sem aumento de custo.

## Verificação
- Conferir que a fila zera os atrasados e que uma nova batida de ponto chega em poucos minutos.

# Captação matinal e prioridade Google Maps

## Implementação
- Antecipar o abastecimento diário para começar às 07:00 BRT, reutilizando o agendamento existente e executando em lotes protegidos até 07:50.
- Manter a meta de 500 WhatsApps confirmados e o teto diário atual de 300 consultas, sem aumentar silenciosamente o custo.
- Fazer o aquecimento priorizar fortemente os leads Google Maps confirmados; UAZAPI será apenas complemento quando faltar lead.
- Validar o estado real de cada destino UAZAPI e usar somente números conectados/online, retirando imediatamente os desconectados da rodada.
- Preservar domingos bloqueados, limites por BM, orçamento diário, deduplicação, bloqueios reais da Meta e devolução de leads após falhas.
- Atualizar o relatório matinal para refletir a nova proporção entre Google Maps e UAZAPI.

## Detalhes técnicos
- Reaproveitar a função de abastecimento e o cron diário já existente, evitando um novo processo contínuo.
- Criar uma execução matinal limitada, com trava contra duplicação, para que falhas ou atrasos sejam retomados com segurança.
- Publicar as funções alteradas e validar os agendamentos, a seleção de destinos e os registros da primeira execução.

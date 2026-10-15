# Pausar notificações enviadas ao seu WhatsApp (via UAZAPI)

## Objetivo

Com vários números UAZAPI banidos, as notificações automáticas que chegam ao seu WhatsApp pessoal (avisos de saúde das instâncias, relatórios, alertas de ponto etc.) ficam falhando ou usando números em risco. Você quer **pausar essas notificações agora** e poder **reativar depois** com um clique.

## O que muda

1. **Interruptor "Notificações no meu WhatsApp"** na aba UAZAPI (card de notificações de cada instância já existe; o interruptor geral fica no topo dessa área, visível só para admin):
   - **Pausado** (estado inicial após esta mudança): nenhuma notificação é enviada ao seu número.
   - **Ativo**: volta tudo ao normal, como hoje.
2. **Enquanto pausado**, as notificações que chegarem à fila são **descartadas** (marcadas como "pausado" no registro), em vez de ficarem acumulando — assim, ao reativar, você não recebe uma enxurrada de avisos antigos.
3. Nada muda no envio de mensagens para clientes, campanhas, lembretes ou no IAGO — apenas os avisos destinados ao **seu** número param.

## Detalhes técnicos

- Migração: adicionar coluna `notificacoes_pausadas boolean not null default true` na tabela `admin_notificacoes_config` (linha id=1). Valor inicial `true` = já nasce pausado, como pedido.
- `supabase/functions/process-admin-notification-queue/index.ts`: logo após reivindicar o próximo item da fila, ler a config; se pausado, finalizar o item com status `pausado` (via `finalizar_notificacao_admin`) e continuar drenando a fila sem enviar. A migração ajusta a função `finalizar_notificacao_admin` para aceitar o novo status (ou usa status `erro` com detalhe "notificações pausadas", sem alteração de função — decidir na implementação pela opção mais simples).
- `src/pages/Acionamento.tsx`: novo `Switch` "Notificações no meu WhatsApp" na seção de notificações, lendo/gravando `admin_notificacoes_config.notificacoes_pausadas` (id=1), com rótulo de estado ("Pausadas" / "Ativas").
- Notificações a outros destinos (grupos, outros números) que passam pelo mesmo caminho direto em `notificar-numeros.ts` **não** são afetadas — a pausa vale só para o número do admin (fila `admin_notificacoes`).
- Sem novo cron, polling ou Realtime — sem impacto de custo.

## Verificação

- Com a pausa ativa, forçar uma notificação e confirmar que o item sai da fila com status "pausado" e nenhuma mensagem chega ao seu WhatsApp.
- Desligar a pausa pelo interruptor e confirmar que uma nova notificação é enviada normalmente.

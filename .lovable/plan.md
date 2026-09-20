# Remetentes de notificações UAZAPI com intervalo seguro

## Objetivo

Permitir escolher, em cada instância da aba **UAZAPI**, quais números podem enviar as notificações pessoais do sistema. As notificações serão distribuídas entre os números escolhidos e nunca sairão em rajada: haverá um intervalo realmente aleatório de **30 a 60 segundos entre uma mensagem e a seguinte**.

## Situação atual confirmada

- O sistema hoje mantém apenas uma instância fixa para avisos administrativos em `admin_notificacoes_config.instancia_notificacao_id`; não existe seleção de vários remetentes na tela.
- O envio central de avisos (`_shared/notificar-admin.ts`) não aplica intervalo entre mensagens.
- Outros avisos usam `_shared/notificar-numeros.ts`, cujo intervalo atual é fixo em apenas 1,5 segundo.
- Dois avisos do IAGO em `whatsapp-chatbot/index.ts` enviam diretamente pela instância do atendimento e não passam pelo controle central.
- Eventos diferentes podem executar ao mesmo tempo. Portanto, colocar uma espera isolada em cada função não impediria duas mensagens simultâneas.

## O que será feito

### 1. Botão em cada instância UAZAPI

- Adicionar no card de cada instância o controle **“Notificações pessoais”**.
- Permitir ativar várias instâncias ao mesmo tempo, conforme decidido.
- Mostrar claramente quais estão habilitadas para esse uso.
- Somente administradores poderão alterar essa seleção.
- Instâncias inativas continuam visíveis, mas não serão usadas enquanto estiverem inativas ou desconectadas.

### 2. Rodízio somente entre os números escolhidos

- Distribuir os avisos em rodízio entre as instâncias habilitadas e conectadas.
- Persistir a última instância usada para o rodízio continuar corretamente entre execuções.
- Se a próxima escolhida estiver desconectada, tentar outra habilitada e conectada.
- Se nenhuma escolhida estiver disponível, usar outra instância ativa e conectada como contingência, conforme decidido, registrando que houve fallback.
- Preservar a instância atualmente configurada, deixando-a habilitada na migração inicial para não interromper notificações existentes.

### 3. Fila única para evitar rajadas

- Centralizar as notificações destinadas ao número pessoal em uma fila leve no banco.
- Reservar a ordem e o próximo horário de envio de forma atômica, impedindo que funções simultâneas enviem juntas.
- Sortear individualmente um intervalo inteiro entre **30 e 60 segundos** após cada envio; não será um valor fixo.
- Processar a fila sob demanda, somente quando houver notificações, sem novo cron, polling permanente ou consultas repetitivas.
- Encadear o processamento apenas enquanto houver itens pendentes, mantendo baixo o custo e liberando rapidamente as funções que originaram o aviso.
- Em falha ou timeout, liberar o item com segurança para nova tentativa, sem duplicar mensagens já entregues.

### 4. Unificar todos os avisos pessoais

- Fazer `_shared/notificar-admin.ts` usar a fila central em vez de enviar imediatamente.
- Nos usos de `_shared/notificar-numeros.ts`, encaminhar pela fila apenas os destinos que correspondem ao número pessoal configurado; relatórios para grupos ou outros destinatários mantêm o comportamento próprio.
- Migrar os dois envios diretos do IAGO para o mesmo fluxo central.
- Manter as chaves de idempotência e o histórico já existentes, corrigindo também a reserva não atômica do fluxo de múltiplos números.

## Banco e segurança

- Criar uma relação entre instâncias e o uso como remetente de notificações, com integridade referencial e auditoria de ativação/desativação.
- Criar a fila com estados `pendente`, `processando`, `enviado` e `erro`, horário agendado, tentativas e instância utilizada.
- Adicionar índices apenas para buscar o próximo item pendente e evitar duplicidades.
- Habilitar RLS e grants explícitos: administradores podem configurar e consultar; o processamento interno usa acesso protegido.
- Não expor tokens das instâncias na interface nem nos registros.

## Verificação

- Ativar duas instâncias e confirmar visualmente o estado nos cards.
- Gerar três avisos próximos e conferir no histórico que os intervalos ficaram individualmente entre 30 e 60 segundos.
- Confirmar o rodízio entre as instâncias habilitadas.
- Simular uma habilitada desconectada e verificar o uso de outra habilitada; depois simular todas indisponíveis e confirmar o fallback para uma ativa conectada.
- Confirmar que notificações idênticas não são duplicadas em execuções concorrentes.
- Confirmar que os avisos do IAGO também entram na fila.
- Validar a tela em computador e celular, as permissões administrativas e os registros de erro.

## Impacto de custo

A solução não cria rotina recorrente. O processamento só funciona quando há avisos pendentes. Haverá uma gravação leve por notificação e execuções sob demanda durante o intervalo necessário, evitando o custo maior de manter todas as funções de origem abertas por 30–60 segundos ou consultar a fila continuamente.

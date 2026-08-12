# Corte drástico do gasto do Lovable Cloud sem prejudicar o sistema

## Diagnóstico confirmado agora

Entre **11 e 12 de agosto**, este projeto consumiu **US$ 18,73** do Cloud:

| Origem | Consumo | Participação |
| --- | ---: | ---: |
| Funções do Cloud | US$ 9,19 | 49% |
| Transferência de dados | US$ 7,02 | 37% |
| Instância Small | US$ 2,48 | 13% |
| Realtime + armazenamento | US$ 0,05 | <1% |

O problema principal, portanto, **não é mais o tamanho da máquina**. Funções e transferência representam 86% do gasto.

### Causa principal: worker de disparo permanece ligado esperando o delay

Nas últimas 24 horas:

- `envio-meta-massa-tick` foi chamado **1.117 vezes** e acumulou **4.125.490 ms** de execução.
- Houve **3 campanhas**, com **2.185 destinatários** e **1.468 envios** até a auditoria.
- O worker usa `sleep()` dentro da função por até 50 segundos para aguardar o intervalo de 10–90 segundos entre mensagens.
- Ao terminar, ele se chama novamente; ao mesmo tempo, o cron de segurança também verifica campanhas todo minuto.
- O início da campanha ainda dispara um tick unitário e outro worker longo em paralelo.

Isso significa que o Cloud cobra uma função durante o tempo em que ela está apenas esperando. Também há risco de workers concorrentes para a mesma campanha.

### Carga secundária confirmada

- O cron executou **1.440 verificações em 24h**, inclusive sem precisar enviar; cada verificação é curta, mas impede uma ociosidade limpa.
- Existem outros **360 ciclos recorrentes/dia**: aquecimento (144), templates (48), saúde de webhook (48), IAGO (48), retenção (24), saúde Meta (12), além dos relatórios.
- O banco está saudável, mas trabalha continuamente: memória 65%, 50/90 conexões, WAL 1 GB e 233.716 transações revertidas desde o boot.
- As consultas historicamente mais caras ainda são campanha/logs/Inbox, com centenas de milhares de execuções acumuladas. O código já recebeu contenções, mas falta transformar os detalhes da campanha em resumo no banco para impedir downloads repetidos.
- O tráfego de saída custou **US$ 7,02 em um dia**. A maior exposição está no fluxo de campanhas: chamadas encadeadas tick → seleção de instância → envio, respostas e leituras de até milhares de linhas. O plano instrumentará bytes por fluxo antes/depois e eliminará as transferências evitáveis.

## Plano de correção

### 1. Substituir o worker que “dorme” por execução curta e exclusiva

- Fazer cada execução do `envio-meta-massa-tick` processar **somente uma mensagem vencida** e encerrar imediatamente, sem `sleep()` e sem loop de 50 segundos.
- Criar trava atômica por campanha para garantir **um único worker por vez**, evitando chamadas duplicadas do início, cron, webhook ou retomada.
- Remover as chamadas duplicadas no início da campanha e manter somente um disparo inicial idempotente.
- Ativar o disparador rápido somente enquanto houver campanha rodando e desativá-lo ao concluir/pausar/cancelar a última campanha.
- Preservar o delay aleatório escolhido, o round-robin, pausa, retomada, retry e filtros de qualidade. O próximo item só será elegível após `proximo_em`.

**Resultado esperado:** deixar de pagar dezenas de segundos de função ociosa por mensagem e eliminar workers sobrepostos, sem acelerar nem pular contatos.

### 2. Tirar a seleção de instância do fan-out de funções

- Mover a seleção/round-robin hoje feita pela função `pick-meta-instance` para uma função transacional no banco, chamada pelo worker curto.
- Buscar apenas as colunas necessárias das instâncias e da configuração, em vez de linhas completas.
- Atualizar score, reserva do item e escolha da instância na mesma operação atômica.

**Resultado esperado:** remover uma invocação de função e várias viagens de rede para cada mensagem, mantendo exatamente as regras atuais de qualidade, pausas, guardrails e rodízio.

### 3. Reduzir transferência de dados das campanhas

- Criar um resumo agregado por campanha no banco: totais por status, últimas falhas e distribuição por instância.
- No painel global, carregar apenas os 30 jobs e seus contadores; baixar itens detalhados somente quando o diálogo estiver aberto.
- Paginar detalhes em blocos pequenos e carregar logs apenas dos telefones da página visível, nunca uma janela de 3.000 registros.
- Aplicar eventos Realtime incrementalmente ao estado, sem reler até 2.000 itens após cada sequência de eventos.
- Manter exportação completa sob demanda, em fluxo paginado próprio.

### 4. Revisar todos os jobs recorrentes sem remover funcionalidades

- Classificar os 25 jobs ativos em: horário fixo, somente quando há trabalho e monitoramento.
- Tornar condicionais os jobs de aquecimento, templates, retenção, saúde e IAGO: primeiro verificar no banco se existe trabalho elegível; função externa só é chamada quando necessário.
- Consolidar verificações de saúde compatíveis em um único ciclo e reduzir frequência apenas onde o dado não exige atualização imediata.
- Não alterar os horários dos relatórios, lembretes, cotações ou regras de aquecimento.

### 5. Cortar consultas e transações descartadas

- Rastrear as **233.716 transações revertidas** por rota/política e corrigir retries ou acessos negados repetitivos.
- Revisar as consultas de maior volume e confirmar com `EXPLAIN ANALYZE` os índices e filtros já aplicados.
- Substituir leituras de linha inteira por projeções mínimas em funções e telas de uso frequente.
- Manter o Inbox e badges com Realtime incremental, `visibilityState` e debounce; remover polling redundante onde o Realtime já cobre a atualização.

### 6. Medição e trava de segurança de custo

- Registrar por fluxo apenas métricas leves: quantidade de invocações, duração, mensagens processadas e bytes aproximados — sem conteúdo de mensagens ou dados pessoais.
- Criar alerta administrativo quando funções/transferência ultrapassarem o padrão diário, apontando qual fluxo cresceu.
- Validar por 24 horas após a mudança: custo de funções, transferência, invocações por mensagem, campanhas concluídas, delays observados e ausência de duplicidade.
- Se o gasto continuar fora do padrão, usar a medição para cortar o próximo maior fluxo, sem tentativa no escuro.

## Ordem segura de implantação

1. Instrumentação mínima e trava de concorrência.
2. Worker curto sem espera + disparador ativo somente durante campanha.
3. Seleção transacional de instância.
4. Resumos/paginação para cortar transferência.
5. Condicionamento dos jobs secundários.
6. Comparação de 24h e ajuste final.

## Critérios de aceite

- Nenhuma mensagem duplicada, pulada ou enviada antes do delay mínimo.
- Pausar, retomar e cancelar continuam imediatos.
- Round-robin e bloqueios de instância permanecem iguais.
- Campanha continua mesmo com o navegador fechado.
- Relatórios, lembretes, IAGO, cotações e aquecimento mantêm suas regras e horários.
- Funções deixam de acumular tempo de espera; meta técnica de **uma execução curta por mensagem**, sem concorrência.
- Queda mensurável de funções e transferência no comparativo de 24 horas.

## Observação financeira

A instância Small representa apenas 13% do gasto atual; reduzi-la ou aumentá-la não resolve o problema. O maior corte virá de remover espera cobrada, fan-out de funções e transferência repetida. As mudanças reduzem consumo — não criam polling, Realtime ou cron permanente adicional.

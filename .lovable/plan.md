# IAGO somente na caixa PADRÃO e custo por conversa no Inbox

## Situação confirmada

- O IAGO ainda está programado para responder na caixa **AQUECIMENTO**: essa caixa possui um modo especial que força respostas, impede escalada humana e trata conversas de teste como pertencentes ao IAGO.
- O atendimento da caixa **PADRÃO** já está separado e continuará ativo, com apresentação como assistente virtual, leitura do histórico e transferência para a fila humana quando necessário.
- A estrutura de custo por mensagem/conversa já foi criada no banco, incluindo tarifas e consultas de resumo/detalhes.
- Essa estrutura ainda não foi conectada aos envios nem ao retorno de entrega da Meta. A tabela de custos está atualmente com **zero registros**, e o cabeçalho da conversa não consulta nem exibe o custo.

## Alterações

### 1. Limitar o IAGO exclusivamente à caixa PADRÃO

- Impedir o acionamento do IAGO em qualquer conversa cujo `folder_id` não seja o da caixa PADRÃO (`null`).
- Aplicar a proteção em dois pontos:
  - no recebimento da mensagem, para não chamar o IAGO fora da PADRÃO;
  - dentro do próprio atendimento do IAGO, para rejeitar chamadas antigas, manuais ou concorrentes vindas de outras caixas.
- Remover do fluxo de AQUECIMENTO a atribuição automática da etiqueta **Atendente: IAGO** para novas conversas de teste.
- Remover as etiquetas existentes do IAGO nos contatos atualmente dentro de AQUECIMENTO e encerrar estados automáticos pendentes, sem apagar conversas ou mensagens.
- Manter intactos o aquecimento entre números, os registros UAZAPI, o atendimento humano e a caixa CERTIFICADO pausada.
- Manter os follow-ups desligados.

### 2. Ativar o registro do custo por mensagem

- Identificar cada saída como **IAGO**, **humano**, **template/campanha** ou **outra automação** no momento em que a mensagem é salva.
- Criar o valor provisório ao aceitar o envio, usando a tarifa vigente configurada para a categoria.
- No retorno oficial da Meta:
  - confirmar o custo somente quando houver entrega/leitura;
  - marcar mensagens gratuitas quando informado pela Meta;
  - zerar tentativas que falharam;
  - atualizar categoria e tipo de cobrança recebidos da Meta.
- Vincular cada lançamento ao contato, à conversa e ao número oficial correspondente.
- Fazer uma recomposição única das mensagens desde **01/10/2026** que já tenham dados suficientes de envio/status, sem inventar custo quando a confirmação não existir.

### 3. Mostrar o custo no cabeçalho da conversa

- Exibir no cabeçalho de cada conversa da caixa PADRÃO:
  - **Custo no mês: R$ X,XX**;
  - selo **Confirmado** ou **Estimado**;
  - quantidade de mensagens cobradas e gratuitas.
- Ao clicar, abrir os detalhes por mensagem com horário, origem (IAGO/equipe/outros), categoria, situação e valor.
- Mostrar também a divisão acumulada **IAGO x equipe humana**.
- Atualizar ao abrir/trocar de conversa e após os eventos de mensagem que o Inbox já recebe, sem criar polling, novo cron ou novo canal em tempo real.
- Exibir estado claro de “sem mensagens cobradas” quando o total for zero, em vez de ocultar a informação.

## Validação

- Confirmar que uma nova mensagem em AQUECIMENTO não chama o IAGO e não recebe sua etiqueta.
- Confirmar que uma nova mensagem na PADRÃO continua recebendo resposta do IAGO e escala corretamente quando necessário.
- Validar envio humano e envio do IAGO sem disparar mensagens reais, conferindo a origem gravada.
- Simular os estados aceito, entregue, gratuito e falha para confirmar os valores e evitar dupla cobrança em reentregas do webhook.
- Conferir o cabeçalho e o detalhamento em computador e celular, inclusive com troca rápida entre conversas.
- Verificar permissões: somente quem já pode abrir a conversa poderá consultar seu custo.

## Impacto de custo e segurança

- Não haverá novo cron, polling ou canal em tempo real.
- A medição acrescenta uma pequena gravação quando uma mensagem é enviada/atualizada e uma consulta indexada ao abrir a conversa.
- O processamento histórico será executado uma única vez e limitado ao período iniciado em 01/10/2026.
- As tarifas exibidas serão as cadastradas no sistema, sempre diferenciando valores estimados dos confirmados pela Meta.

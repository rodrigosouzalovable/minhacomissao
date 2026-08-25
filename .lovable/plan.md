# Corrigir IAGO na caixa AQUECIMENTO

## Diagnóstico confirmado

- A mensagem recente da conversa **Rodrigo - Certificadora CNPJ** entrou na caixa **AQUECIMENTO**, pela instância **THIAGO 4 N1**, com `provider = uazapi`.
- A conversa recebeu a etiqueta **Atendente: Iago Ribeiro de Souza** corretamente.
- O IAGO foi acionado, mas não respondeu porque encontrou o mesmo telefone em outra conversa fora da caixa AQUECIMENTO com a etiqueta **Atendente: RODRIGO RIBEIRO DE SOUZA**.
- A regra atual bloqueia o IAGO quando existe qualquer atendente humano vinculado ao mesmo telefone em qualquer caixa/instância. Isso é correto para atendimento humano normal, mas está impedindo o IAGO de atender a caixa AQUECIMENTO quando o mesmo telefone já existe em outra conversa.

## Alerta de custo Lovable Cloud

Esta correção pode aumentar o consumo de IA, porque o IAGO deixará de ignorar mensagens da caixa AQUECIMENTO que antes eram bloqueadas por etiqueta humana em outra caixa.

Impacto estimado: baixo a moderado, proporcional ao volume de mensagens recebidas nos números UAZAPI da caixa AQUECIMENTO. Não será criado cron, polling, loop novo ou canal em tempo real novo.

## O que será feito

1. **Criar exceção segura para AQUECIMENTO**
   - Quando a conversa estiver na caixa **AQUECIMENTO** e a instância for `uazapi`, o IAGO não será bloqueado por etiqueta humana encontrada em outra conversa do mesmo telefone.
   - Ele continuará respeitando a etiqueta da conversa atual: se a própria conversa não estiver com IAGO, ele não assume.

2. **Manter proteção nas outras caixas**
   - A regra de silêncio por atendente humano continuará valendo para conversas fora da AQUECIMENTO.
   - Assim, não desfazemos a proteção já criada para evitar que o IAGO entre em conversas de atendentes humanos.

3. **Garantir atendimento de mensagens futuras na AQUECIMENTO**
   - O webhook UAZAPI continuará espelhando mensagens para o Inbox Meta Oficial.
   - Toda nova mensagem de entrada na caixa AQUECIMENTO com etiqueta do IAGO deverá chamar `iago-atendimento` e gerar resposta, salvo casos de bloqueio definitivo como opt-out, número errado/falecimento ou destinatário recusado pela UAZAPI.

4. **Responder pendências de hoje**
   - Localizar conversas de hoje na caixa AQUECIMENTO em que a última mensagem é de entrada e não existe saída posterior.
   - Reprocessar essas entradas com o IAGO depois da correção.
   - A conversa exibida na imagem será incluída nessa verificação.

5. **Validar**
   - Consultar logs da função `iago-atendimento` depois do ajuste.
   - Confirmar que a conversa deixa de retornar `atendente humano vinculado` e passa a gerar envio ou uma falha real de entrega, se o destinatário for recusado pela UAZAPI.

## Detalhes técnicos

- Ajustar `temAtendenteHumanoNoTelefone` ou sua chamada em `iago-atendimento` para aceitar um modo de exceção quando:
  - `contato.folder_id` for a pasta AQUECIMENTO; e
  - `meta_whatsapp_instances.provider = 'uazapi'`.
- Consultar a instância do contato dentro de `iago-atendimento` para saber se é UAZAPI.
- Criar uma execução pontual de reprocessamento via chamada da função `iago-atendimento` para as mensagens elegíveis de hoje.
- Não adicionar cron, polling ou automação recorrente nova.

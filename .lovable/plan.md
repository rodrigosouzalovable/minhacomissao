# Fazer o IAGO responder sempre na caixa AQUECIMENTO

## O que foi verificado

- A mensagem **"oi"** chegou hoje às 07:45 BRT na caixa **AQUECIMENTO**, na instância **THIAGO 4 B1**, provider **UAZAPI**.
- A conversa recebeu a etiqueta correta: **Atendente: Iago Ribeiro de Souza**.
- Mesmo assim o IAGO não respondeu porque encontrou outro contato com o mesmo telefone/sufixo vinculado ao atendente humano **RODRIGO RIBEIRO DE SOUZA** em outra conversa da API oficial.
- O log confirma o bloqueio: **"atendente humano vinculado — IAGO não responde"**.

## Por que isso está acontecendo

Existe uma trava global criada para impedir o IAGO de entrar em conversas que já têm atendente humano. Essa trava compara o telefone pelos últimos 8 dígitos em todas as caixas/instâncias.

Ela é correta para conversas normais, mas está bloqueando indevidamente a caixa **AQUECIMENTO**, porque os números UAZAPI espelhados podem ter o mesmo telefone aparecendo também na API oficial com um atendente humano.

## O que será corrigido

1. **Exceção obrigatória para AQUECIMENTO + UAZAPI**
   - Quando a conversa estiver na caixa **AQUECIMENTO** e a instância for **UAZAPI**, o IAGO não será bloqueado por atendente humano encontrado em outra caixa/instância.
   - Ele continuará respondendo a mensagem normalmente, desde que a conversa esteja etiquetada com o IAGO.

2. **Manter a proteção nas conversas normais**
   - Fora da caixa AQUECIMENTO/UAZAPI, a trava continua igual: se houver atendente humano vinculado, o IAGO fica calado.
   - Isso preserva o comportamento pedido anteriormente para não atrapalhar atendimentos humanos reais.

3. **Follow-up também seguirá a exceção**
   - O follow-up automático do IAGO também deixará de ser bloqueado nessa situação específica da caixa AQUECIMENTO/UAZAPI.

4. **Garantir resposta para mensagens de hoje**
   - Depois da correção, vou destravar/reenfileirar a conversa recente que recebeu o "oi" para o IAGO responder.

## Detalhes técnicos

- Ajustar `temAtendenteHumanoNoTelefone` para receber contexto da conversa: `folder_id` e `provider`.
- Se `folder_id` for a caixa AQUECIMENTO e `provider='uazapi'`, retornar sem bloquear por humano de outra caixa.
- Atualizar `iago-atendimento` e `iago-followup-tick` para passar esse contexto.
- Rodar uma correção pontual no estado da conversa do contato afetado para permitir nova tentativa.
- Sem novo cron, sem polling e sem aumento relevante de custo: é apenas uma condição extra na regra já existente.

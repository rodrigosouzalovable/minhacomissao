# Corrigir o rodízio e impedir respostas repetidas do IAGO

## Diagnóstico confirmado

- A caixa Padrão possui seis atendentes ativos e elegíveis: Anna, Yasmim, Fernanda, Wallace, Thailinny e IAGO.
- O critério atual ainda escolhe quem tem **menos atribuições no dia**. Hoje os humanos estavam com 19–27 conversas e o IAGO com 3; por isso as próximas conversas tendem a cair nele até alcançar os demais. Isso é compensação, não rodízio sequencial.
- Existem dois caminhos de atribuição: o webhook e um gatilho do banco. Ambos podem participar da mesma entrada e precisam deixar de tomar decisões separadas.
- Na conversa mostrada, chegaram duas entradas distintas em poucos segundos (`VERIFICAR PROPOSTA` e `Oi`). Elas iniciaram execuções simultâneas do IAGO antes de o primeiro atendimento terminar; cada execução gerou saudação e pedido de CPF, causando a repetição.

## O que será feito

1. **Rodízio sequencial de verdade, sem compensação**
   - Trocar “menor carga do dia” por uma fila circular seguindo a ordem configurada.
   - Sequência esperada: Anna → Yasmim → Fernanda → Wallace → Thailinny → IAGO → Anna…
   - O IAGO recebe somente a vez dele, independentemente de quantas conversas os demais já receberam antes de sua ativação.
   - O rodízio será separado por caixa de mensagens e considerará apenas responsáveis ativos e com permissão de atendimento.

2. **Uma única decisão de atribuição**
   - Centralizar a escolha em uma função atômica do banco, com bloqueio curto por caixa, evitando que mensagens simultâneas escolham o mesmo próximo atendente.
   - Remover a disputa entre o gatilho e o webhook; o webhook continuará aplicando as prioridades já existentes e chamará o rodízio somente quando nenhuma prioridade definir um atendente.
   - Manter uma única etiqueta de atendente por conversa.

3. **Trava contra repetição do IAGO**
   - Identificar cada mensagem recebida pelo ID único da Meta e registrar atomicamente quando ela entra em processamento.
   - Permitir apenas uma execução do IAGO por conversa por vez.
   - Se outra mensagem chegar enquanto ele responde, ela será incorporada ao próximo contexto, sem disparar outra saudação ou outro pedido igual.
   - Marcar a entrada como concluída somente depois de salvar a resposta e o estado; tentativas repetidas do webhook serão ignoradas com segurança.

4. **Respostas conscientes do histórico**
   - Antes de responder, recarregar o histórico mais recente após adquirir a trava.
   - Proibir nova apresentação quando o IAGO já se apresentou e não repetir pedido de CPF se esse pedido já for a última ação pendente.
   - Preservar valores, regras de negociação e tom profissional já configurados.

5. **Validação**
   - Testar uma rodada completa com os seis atendentes e confirmar a ordem circular, sem concentração no IAGO.
   - Simular duas entradas quase simultâneas na mesma conversa e confirmar apenas um fluxo coerente de resposta.
   - Conferir no banco a sequência das novas etiquetas e nos logs que entradas duplicadas/concorrentes foram ignoradas.

## Detalhes técnicos

- `meta-whatsapp-webhook`: retirar a ordenação por carga diária, centralizar a atribuição e enviar o identificador da mensagem recebida ao IAGO.
- Banco: substituir o comportamento do gatilho `atribuir_atendente_fila()` por uma operação atômica compatível com a prioridade do webhook e criar o controle idempotente de processamento do IAGO.
- `iago-atendimento`: adquirir/liberar a trava por contato, deduplicar pelo ID da entrada, recarregar histórico e atualizar o estado de forma atômica.
- Sem novo cron, polling ou canal em tempo real; a correção não adiciona processamento recorrente.

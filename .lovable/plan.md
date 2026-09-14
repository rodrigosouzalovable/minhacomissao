# Corrigir bolinha vermelha e confirmar reenvios da campanha Meta

## Diagnóstico confirmado

- A bolinha vermelha representa uma falha de entrega devolvida pela Meta, não apenas uma falha visual.
- Hoje, a maior causa é **“Business Account locked” (#131031)** em números da campanha `Novo Mundo1`. Também houve poucos casos de `#131042` (pendência de pagamento) e `#131026` (mensagem não entregue).
- O sistema já protege as contas: retira da campanha a instância com bloqueio confirmado e não insiste nela.
- O contato volta automaticamente para a fila e tenta outra instância elegível, sem repetir a instância que falhou, por até 3 tentativas. Os dados de hoje confirmam contatos enviados com sucesso na 2ª, 3ª e 4ª passagem contabilizada pelo sistema.
- Existe um erro de exibição: o painel reúne o histórico pelo telefone e dá prioridade permanente ao estado “falhou”. Assim, uma tentativa antiga com falha continua mostrando vermelho mesmo quando uma tentativa posterior foi entregue ou lida.
- Depois do limite de tentativas, ou quando não resta outra instância saudável, o contato permanece como erro final e só volta mediante a ação manual de tentar novamente.

## Implementação

1. **Corrigir o estado exibido por contato**
   - Relacionar a entrega à tentativa atual da campanha pelo identificador real da mensagem.
   - Quando houver mais de uma tentativa, mostrar o resultado mais recente, em vez de deixar uma falha antiga vencer para sempre.
   - Preservar o histórico das tentativas anteriores para auditoria, sem usar esse histórico para pintar o envio atual de vermelho.

2. **Deixar a nova tentativa transparente**
   - Exibir estados distintos: “tentando novamente”, “entregue após nova tentativa” e “falha final”.
   - Informar quantas tentativas ocorreram e qual instância concluiu o envio.
   - Manter o motivo técnico disponível nos detalhes, com explicação simples para `#131031`, `#131042` e `#131026`.

3. **Manter as proteções atuais**
   - Nunca reenviar pela mesma instância que acabou de falhar.
   - Continuar retirando imediatamente números com bloqueio real confirmado pela Meta.
   - Não transformar bloqueio de conta em erro do destinatário e não cobrar tentativa rejeitada como entrega.
   - Após esgotar as alternativas, marcar como falha final e disponibilizar o reenvio manual somente por instâncias novamente validadas.

4. **Validar com uma campanha real**
   - Conferir um contato que falhou e depois foi entregue por outra instância.
   - Confirmar que ele deixa de aparecer vermelho e passa a mostrar o resultado final correto.
   - Confirmar que contatos ainda bloqueados permanecem protegidos e não entram em repetição infinita.

## Resultado esperado

A bolinha vermelha ficará restrita às falhas realmente finais. Reenvios bem-sucedidos aparecerão como entregues, enquanto bloqueios reais continuarão afastando a instância afetada e redirecionando o contato com segurança.

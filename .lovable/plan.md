# Atualizar instâncias e continuar a campanha

## Objetivo

Transformar o botão **Atualizar** de **Instâncias do disparo** em uma recuperação da campanha: revalidar na Meta os números retirados, devolver os que estiverem realmente liberados e continuar o envio sem repetir mensagens já enviadas.

## Alterações

1. **Revalidar ao clicar em Atualizar**
   - Consultar na Meta somente as instâncias desta campanha que estão ignoradas ou bloqueadas.
   - Exibir carregamento durante a conferência e impedir cliques duplicados.
   - Manter essa ação manual, sem criar consulta recorrente ou novo consumo em segundo plano.

2. **Devolver apenas instâncias saudáveis**
   - Recolocar no rodízio as instâncias que a Meta confirmar como conectadas e sem bloqueio, banimento ou restrição de envio.
   - Limpar, para essas instâncias, o bloqueio registrado na campanha e o motivo antigo de `Business Account locked`.
   - Manter fora do disparo as instâncias que continuarem bloqueadas, banidas, com pendência de pagamento ou YELLOW/RED conforme as regras atuais.

3. **Retomar o disparo com segurança**
   - Reabrir a campanha quando ao menos uma instância for liberada.
   - Devolver à fila apenas destinatários pendentes ou com falha que ainda não tiveram envio confirmado.
   - Redistribuir esses destinatários entre as instâncias disponíveis e continuar pelo worker correto, preservando o intervalo configurado e o round-robin.
   - Nunca reenviar itens já marcados como enviados, entregues ou lidos.

4. **Mostrar o resultado na mesma área**
   - Atualizar imediatamente as listas de ativas e ignoradas.
   - Informar quantas instâncias voltaram, quantas permaneceram bloqueadas e quantos destinatários retornaram à fila.
   - Se nenhuma instância estiver liberada, manter a campanha parada e mostrar os motivos confirmados.

## Segurança e permissões

- Manter a recuperação completa restrita a quem já pode controlar a campanha; cada usuário continua acessando somente suas próprias campanhas, com a permissão administrativa existente quando aplicável.
- Revalidar no servidor antes de remover qualquer bloqueio; a tela não poderá forçar uma instância realmente bloqueada.
- Tornar a ação idempotente para que cliques repetidos não dupliquem itens nem disparem workers concorrentes.

## Validação

- Instância com bloqueio antigo já liberado volta ao rodízio e a campanha continua.
- Instância ainda bloqueada permanece ignorada com o motivo correto.
- Campanha com várias instâncias recupera somente as saudáveis.
- Destinatários com falha sem entrega podem ser tentados novamente; enviados, entregues e lidos não são duplicados.
- O botão mostra carregamento, atualiza os totais e apresenta o resultado da recuperação.
- Confirmar funcionamento em campanha serial e em Modo Rajada.

## Custo

A consulta acontecerá somente ao clicar em **Atualizar** e apenas para as instâncias ignoradas da campanha. Não será criado cron, polling adicional ou rotina recorrente.

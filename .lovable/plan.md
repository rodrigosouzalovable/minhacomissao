# Corrigir o ritmo configurado da campanha Meta

## O que foi confirmado

- A campanha **dib municipios 3000** está gravada com intervalo **1–1 segundo**, mas usa o processamento sequencial, não o modo rajada.
- Nos últimos 40 envios consultados, os intervalos ficaram entre **1,68 e 31,19 segundos**, com média de **4,43 segundos**. Portanto, não é apenas uma mensagem incorreta na tela: o ritmo real está mais lento.
- O estado atual da campanha registra **RateLimitError**, com pedido de aguardar **6.656 ms**. A origem exata desse erro ainda precisa ser correlacionada com os registros da execução; não será atribuída à Meta sem essa confirmação.
- O processamento já desconta o tempo gasto do intervalo nos ciclos curtos, mas faz seleção, consultas e envio sequencialmente. Ao devolver o trabalho ao agendamento existente, pode esperar pelo próximo ciclo de **10 segundos**.
- O contador da tela vem de `proximo_em`; não há um intervalo visual fixo de 15 segundos.

## Correção

1. **Identificar a origem das esperas.** Separar tempo gasto no processamento, pausa por limitação de velocidade e intervalo entre execuções. Conferir os registros da campanha atual antes de alterar o envio.
2. **Respeitar o intervalo sem acrescentar esperas desnecessárias.** Ajustar o processamento existente para iniciar uma mensagem por segundo quando houver disponibilidade, usando tempo entre inícios de envio, não uma espera adicional após toda a operação. Reduzir consultas repetidas e a dependência do ciclo de 10 segundos para intervalos curtos.
3. **Manter o ritmo global pedido.** Não transformar 1 mensagem por segundo em 1 mensagem por segundo por instância. Preservar a distribuição entre as instâncias selecionadas.
4. **Respeitar limitações externas.** Quando o serviço exigir espera, cumprir o prazo informado, preservar o contato pendente e retomar sem duplicar. Não prometer cadência exata enquanto houver limitação ou resposta lenta.
5. **Explicar a espera na tela.** Mostrar “Intervalo configurado: 1 segundo”, o ritmo observado e um motivo claro quando houver limitação de velocidade ou retomada entre execuções, em vez de apresentar tudo como atraso configurado.
6. **Aplicar à campanha atual e às próximas.** Preservar os enviados, continuar somente com pendentes e não alterar template, destinatários, instâncias ou custo unitário da mensagem.

## Segurança e custo

- Manter reserva atômica de destinatários, trava do processamento, limite da lista, blacklist, cotas e bloqueios reais. Não executar trabalhadores concorrentes sem coordenação.
- **Alerta de custo Lovable Cloud:** acelerar de aproximadamente 1 envio a cada 4,43 segundos para 1 por segundo pode concentrar cerca de **4,4 vezes mais trabalho por minuto** durante a campanha. O total de mensagens não aumenta; o custo adicional de processamento não pode ser calculado em reais antecipadamente. Priorizar reutilização de consultas e não criar agendamentos permanentes, consultas periódicas ou canais novos.
- A aprovação deste plano autoriza a tentativa de corrigir o ritmo da campanha em andamento, respeitando as pausas exigidas pelos serviços.

## Validação

- Testar intervalo de 1 segundo, processamento mais lento, pausa com prazo informado, retomada, cancelamento e ausência de duplicatas.
- Conferir que a contagem nunca ultrapassa a lista e que a distribuição não multiplica o ritmo global.
- Após aplicar, comparar uma amostra dos novos horários da campanha atual e informar o ritmo realmente alcançado; não criar envios extras de teste.

## Detalhes técnicos

- Revisar `envio-meta-massa-tick`, seleção/envio de instâncias e os registros da função que originou o `RateLimitError`.
- Corrigir conjuntamente cálculo de prazo, orçamento da execução e retomada, mantendo a trava existente e processamento limitado por execução.
- Ajustar `EnvioMetaSendingContext` e `CampanhaDetalheDialog` para distinguir intervalo configurado e espera operacional.
- Caso atingir o ritmo exija uma estrutura adicional com aumento de custo não coberto acima, apresentar essa alternativa antes de implementá-la.
# Retirar a trava interna que está pausando a campanha

## Diagnóstico confirmado

- A campanha ativa está parada com **654 contatos ainda pendentes**: 357 enviados, 5 erros, total de 1.011.
- Os números ainda têm bastante limite: estão com tier de **10.000/dia** e uso entre aproximadamente 68 e 76 hoje.
- Portanto, **não é a cota real da Meta**.
- O bloqueio vem do **Guardião de Engajamento**: 8 números GREEN receberam fator zero porque tiveram resposta abaixo de 8% nas últimas 4 horas. Esse guardião continua cortando campanhas mesmo quando o modo **Sem teto interno** está ligado.
- O aviso da tela está incorreto ao chamar isso de “cota real da Meta atingida”.

## Alteração

1. Quando **Sem teto interno** estiver ligado, o Guardião de Engajamento continuará calculando resposta, leitura e acionando aquecimento, mas não reduzirá nem interromperá campanhas.
2. Manter somente as travas reais: limite/tier da Meta, erro recusado pela Meta, número desconectado, pagamento, template inválido e demais bloqueios efetivos.
3. Corrigir o detalhe da campanha para diferenciar claramente:
   - cota real da Meta;
   - bloqueio real da Meta;
   - aviso informativo de baixo engajamento.
4. Limpar os fatores de corte internos de hoje dos números desta campanha e retomá-la imediatamente.
5. Preservar os contatos já enviados/aceitos e recolocar somente os pendentes; nenhuma mensagem concluída será duplicada.
6. Confirmar que o número já bloqueado por falha real permanece fora e que os números GREEN voltam a avançar no rodízio.

## Risco e custo

- Não será criado cron, consulta recorrente ou canal em tempo real novo; o impacto adicional na Lovable Cloud é desprezível.
- Sem esse freio, a campanha pode consumir mais rapidamente a cota e o custo de mensagens da Meta.
- Taxa de resposta/leitura baixa pode prejudicar a qualidade dos números. As métricas e o aquecimento continuam ativos como alerta e recuperação, mas sem pausar os disparos.

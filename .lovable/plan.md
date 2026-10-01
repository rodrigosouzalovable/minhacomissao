# Reativar automaticamente os seis números RED/YELLOW aptos

## Objetivo

Corrigir a recuperação para que números próprios, conectados e com qualidade RED/YELLOW entrem novamente no aquecimento sem depender de uma campanha ou de alguém clicar em “Verificar status”.

## Situação confirmada

Os seis números abaixo estão conectados, autorizados, sem bloqueio registrado e com a recuperação desligada:

- SOUZA 62 8269-9528 — RED
- SOUZA 62 8270-2353 — YELLOW
- SOUZA 62 8270-2357 — RED
- SOUZA 62 8274-9854 — RED
- SOUZA 62 8275-2530 — RED
- SOUZA 62 8275-5585 — RED

A reconciliação já existe na checagem de saúde, mas essa checagem não possui execução periódica própria. O processo de recuperação, executado a cada 10 minutos, busca apenas números que já estejam com a recuperação ativa; por isso ele não consegue corrigir sozinho esses casos.

## Execução

1. Acrescentar ao processo existente de recuperação uma reconciliação inicial, antes dos envios:
   - localizar números oficiais próprios em RED/YELLOW;
   - exigir status conectado, autorização de aquecimento, ausência de parceiro/teste e ausência de bloqueio ou restrição fatal da Meta;
   - ativar a recuperação, preservar a data original quando existir, definir meta diária entre 10 e 20 e liberar o próximo envio;
   - nunca reativar os números bloqueados por #131031, #131042, violação de conta ou outra recusa fatal confirmada.
2. Registrar ou abrir o ciclo de medição desses números para acompanhar o tempo exato até voltarem a GREEN.
3. Reativar imediatamente os seis números confirmados, sem alterar os dois bloqueados nem os quatro pertencentes a outros usuários.
4. Executar uma rodada controlada dentro da janela vigente e confirmar no registro que os destinos escolhidos são números UAZAPI conectados da caixa AQUECIMENTO.
5. Validar o resultado final por número: recuperação ativa, horário do próximo envio, envio aceito ou motivo seguro para não enviar.

## Custo e segurança

Não será criado novo agendamento, nova consulta repetitiva nem nova tabela. A correção reutiliza a rotina de 10 minutos existente. Haverá apenas o custo normal das mensagens de recuperação já autorizado, limitado a 10–20 mensagens por número/dia e aos controles atuais de destino e horário.

## Resultado esperado

Os seis números entram no aquecimento hoje e, no futuro, qualquer número próprio apto que permanecer RED/YELLOW será recuperado automaticamente pela rotina existente, enquanto bloqueios reais da Meta continuarão protegidos contra novos envios.

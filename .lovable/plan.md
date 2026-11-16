# Boleto automatico ao clicar "QUERO O BOLETO"

## O que aconteceu
- A Daniela (UME, numero SOUZA 62 8279-1929) clicou em "QUERO O BOLETO" as 08:59. O sistema recebeu o clique e chamou o IAGO.
- O IAGO recusou com "IAGO nao atende esta caixa": hoje a caixa PADRAO tem so 5 atendentes humanos (Yasmim, Anna Flavia, Fernanda, Wallace e Thailinny) e o IAGO nao esta entre eles.
- O envio automatico do boleto/PIX fica dentro do IAGO e so roda depois dessa conferencia. Sem o IAGO na caixa, nenhum boleto sai, para nenhum cliente da PADRAO.

## Correcao
1. Fazer o boleto/PIX automatico rodar antes da conferencia de caixa: qualquer clique em "QUERO O BOLETO" (ou pedido claro de boleto/PIX) de cliente UME, Odres ou Novo Mundo gera e envia na hora, mesmo sem o IAGO na caixa e mesmo com atendente humano.
2. Continua fora da AQUECIMENTO, BLACK FRIDAY, USA B2B e CERTIFICADO.
3. O restante do IAGO (conversa livre) segue obedecendo a caixa: se ele nao esta na PADRAO, ele nao conversa.
4. Reenviar agora o boleto para a Daniela, se o dela ainda estiver em aberto.

## Detalhes tecnicos
- `supabase/functions/iago-atendimento/index.ts`: mover o bloco `ehPedidoBoletoImediato` para antes do `iagoAtendeCaixa`, resolvendo o credor antes; registrar o motivo no log quando nao conseguir gerar (sem CPF, sem parcela).
- Adicionar teste: pedido de boleto na PADRAO sem IAGO membro ainda gera boleto.
- Sem novo cron ou polling.

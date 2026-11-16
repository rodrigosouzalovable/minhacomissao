# Parar PIX errado do IAGO e enviar só pelo botão "Quero o boleto"

## O que está errado
Hoje o IAGO envia PIX sempre que o cliente escreve "pix", "boleto", "segunda via" etc. (até em áudio transcrito). Nesses casos ele gera um boleto único com **toda a dívida** do cliente (ex.: Mariana recebeu R$ 30.128,51 quando falava de "18 vezes de 169").

## O que vai mudar
1. **Desligar imediatamente** os envios automáticos por texto livre:
   - o envio que roda mesmo com atendente na conversa (palavra "pix/boleto");
   - o envio durante a conversa do IAGO (mesma regra);
   - o "SIM, ENVIAR PIX AGORA" da repescagem também passa a usar a mesma regra nova abaixo.
   Nesses casos o IAGO não manda PIX; o atendente segue pela Calculadora UME.
2. **Só o botão "QUERO O BOLETO"** (clique real no botão do template de lembrete/vencimento) dispara o envio automático.
3. **Parcela certa, não a dívida toda:** o sistema consulta o backoffice da UME/Odres, pega a **parcela do acordo em atraso** (a mais antiga) ou, se não houver atraso, a **próxima a vencer**, e gera o boleto/PIX só dessa parcela.
4. **Trava de segurança:** se não achar exatamente uma parcela do acordo, ou o valor retornado for maior que o da parcela, **não envia** e avisa o atendente na conversa para tratar manualmente.

## Detalhes técnicos
- `iago-atendimento/index.ts`: remover os gatilhos por texto (linhas ~138 e ~985); criar gatilho apenas para mensagem do tipo botão com payload/texto "QUERO O BOLETO".
- Usar `gerarBoletos` com o ID da parcela (SFTP primeiro, depois consulta online) em vez de `gerarBoletoUnico` (saldo total).
- Validar valor da cobrança ≤ valor da parcela (+ tolerância de juros) antes de enviar.
- Teste: texto "pix" não dispara; botão dispara; valor acima da parcela bloqueia.

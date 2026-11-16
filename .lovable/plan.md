# Corrigir respostas do IAGO na USA B2B e reduzir para 1 mensagem

## O que está acontecendo (confirmado)
As respostas do IAGO não chegam porque a função que envia texto coloca "55" na frente do número americano. Exemplo Silva's Market: o cliente escreveu de +1 407-615-3000, mas as 4 respostas do IAGO foram para 55 14076153000 e a Meta recusou ("Message undeliverable"). Só o template inicial, que usa outra regra, saiu correto. Nas últimas horas, 144 mensagens foram recusadas por esse motivo.

Além disso, o IAGO manda até 2 mensagens por resposta e pode responder de novo antes da resposta do cliente (no print saíram 4 mensagens seguidas).

## O que vou mudar
1. **Número correto nas respostas:** o envio de texto passa a usar a mesma regra do template, que já reconhece números +1 dos EUA. Os números brasileiros continuam iguais.
2. **Só 1 mensagem por resposta** nas caixas USA B2B e BLACK FRIDAY: uma apresentação curta (quem somos + por que entramos em contato + uma pergunta).
3. **Sem repetição:** se o IAGO já respondeu e o cliente ainda não escreveu de novo, ele não manda outra mensagem.
4. **Reenvio único:** os clientes que responderam e não receberam a resposta (por causa do 55) recebem uma única mensagem correta, apenas se a janela de 24h ainda estiver aberta.

Exemplo de mensagem: "Desculpe a confusão! Ajudamos negócios brasileiros nos EUA a responder clientes no WhatsApp na hora, sem perder vendas. Vocês recebem muitos pedidos por lá?"

## Detalhes técnicos
- `send-whatsapp-meta-text`: trocar `formatTel` por `telefoneMeta` (`_shared/meta-destinatario.ts`) no caminho Meta.
- `_shared/vendas-usa.ts` e prompt Black Friday: "exatamente 1 mensagem, até 2 linhas"; no `iago-atendimento`, cortar `mensagens` para 1 em `modoVendas`.
- Trava: em `modoVendas`, não responder se a última mensagem da conversa já for saída do IAGO.
- Reenvio pontual para conversas USA B2B com última entrada < 24h e respostas com erro "undeliverable" para 55+1.
- Teste do número: `14076153000` → `14076153000`; `62991672674` → `5562991672674`.

# Mensagens de recusa da UME em português claro

## O que significa o erro da imagem
"Installment 8441643 was paid in previous renegotiation 208474" quer dizer: **uma das parcelas escolhidas já foi quitada num acordo anterior (renegociação 208474)**. Ela não pode entrar num novo acordo. É preciso tirar essa parcela da seleção, ou conferir no backoffice se o acordo 208474 ainda está valendo.

## O que será feito
Hoje a tela mostra o texto da UME em inglês, do jeito que ele chega ("A UME recusou: ..."). Vou trocar isso por uma mensagem em português, com:
- **o que aconteceu**, em linguagem simples;
- **o que fazer**, numa linha.

Exemplos:
- Parcela já paga em renegociação anterior → "A parcela 8441643 já foi paga no acordo anterior 208474 e não pode entrar em um novo acordo. Tire essa parcela da seleção ou confira o acordo 208474 no backoffice."
- Juros acima do limite → "A taxa de juros (X%) está acima do máximo permitido pela UME (8%). Reduza o acréscimo ou o número de parcelas."
- Renegociação em aberto → "Este cliente já tem um acordo em aberto na UME. Encerre ou confira esse acordo no backoffice antes de lançar outro."
- Parcela não encontrada ou inválida, data de vencimento inválida, valor mínimo, falha de login (TEP) e UME fora do ar → cada um com sua frase.
- Erro desconhecido → "A UME recusou o acordo por um motivo não identificado." O texto original continua guardado no registro interno, para análise.

A mesma tradução vale para a simulação, a efetivação e a geração do boleto/PIX.

## Detalhes técnicos
- Novo `supabase/functions/_shared/ume-erros.ts` com `traduzirErroUme(msg)`: as regras são expressões regulares que capturam os números (parcela, renegociação, taxas). Devolve `{ titulo, acao }`.
- Usar em `ume-acordo-api` (linhas 98 e 117) e `ume-boleto`. Mantém `error`/`detalhe` originais no JSON e no log.
- Teste unitário com as frases reais ("Installment ... was paid in previous renegotiation ...", "Interest rate ... above maximum ...").
- Deploy de `ume-acordo-api` e `ume-boleto`.

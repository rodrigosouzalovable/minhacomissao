# Ocultar "Sua Comissão" para funcionários

Na tela de lançamento de novo acordo, o quadro "Sua Comissão" (faixa, valor que vai receber e comissão por parcela) deixa de aparecer para funcionários.

- Seu login de admin continua exatamente igual (o quadro de comissão do admin não muda).
- Nenhum cálculo ou regra de comissão é alterado; só deixa de ser exibido para funcionários.

## Detalhe técnico
Em `src/pages/NovoAcordo.tsx`, remover o bloco `{calculo && !isAdmin && (...)}` (preview "Sua Comissão", ~linhas 1035-1125).

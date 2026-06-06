## Contexto

No componente de card de acordo em `src/pages/Acordos.tsx` (linhas ~178-318), quando o acordo é negociado e ainda não foi marcado como "boleto enviado", o card recebe um efeito amarelado/laranja com `ring`, `animate-pulse` e o badge "Aguardando envio do boleto". O toggle só muda quando o usuário clica manualmente no botão de envio.

O card já recebe a prop `ultimaParcelaPaga` (linha 172), que é populada sempre que existe pelo menos uma parcela paga no acordo. Esse é o sinal natural para detectar "tem pagamento".

## O que será feito

Apenas mudança visual em `src/pages/Acordos.tsx`, sem alterar dados nem o campo `boleto_enviado` no banco:

1. Criar uma variável local no card, `boletoEnviadoEfetivo = acordo.boleto_enviado || !!ultimaParcelaPaga`.
2. Usar `boletoEnviadoEfetivo` no lugar de `acordo.boleto_enviado` em:
   - Classe de fundo laranja/amarelo (linha 185) — assim some o efeito amarelado/pulse.
   - Badge "Boleto Enviado / Aguardando envio do boleto" (linhas 272-280).
   - Botão de toggle (cor/ícone/tooltip nas linhas 291-314) — visualmente passa a refletir "enviado", mas o clique continua alternando o campo real `acordo.boleto_enviado` (comportamento atual preservado).

## Fora de escopo

- Não alterar a coluna `boleto_enviado` no banco automaticamente.
- Não mexer em ordenação, filtros, RLS ou lógica de pagamentos.
- Sem mudanças em outras páginas.

# IAGO responde em inglês na caixa USA B2B

## O que muda
- Quando o cliente escrever em inglês ou pedir inglês ("English please", "Do you speak English?", "In English"), o IAGO reenvia a explicação completa em inglês, em 1 única mensagem (mesmo conteúdo da primeira resposta: ferramenta de IA no WhatsApp 24/7, ele configura, substitui recepcionista, não é marketing, oferece demonstração).
- A partir daí, toda a conversa continua em inglês, até o cliente voltar a escrever em português.
- Pedido de idioma nunca é tratado como recusa ou resposta automática (não encerra a conversa).
- Mensagem reserva (quando a IA falha) também passa a ter versão em inglês, usada se o cliente escreveu em inglês.

Exemplo: "Hi! We're reaching out because we have a tool that answers your customers on WhatsApp automatically, 24/7, using AI. You set up what it says: questions, prices, hours and orders. No customer goes unanswered and you don't need to hire a receptionist just to reply. This isn't marketing or ads. Can I show you a quick demo?"

## Detalhes técnicos
- `supabase/functions/_shared/vendas-usa.ts`: nova regra IDIOMA no prompt (responder no idioma do cliente; pedido de inglês = repetir a primeira resposta em inglês, sem contar como "repetição"); adicionar `FALLBACK_USA_EN` e helper simples `pareceIngles(texto)`.
- `iago-atendimento/index.ts`: usar `FALLBACK_USA_EN` quando a última mensagem do cliente parecer inglês; garantir que a trava "já respondeu, aguarda" não bloqueie, pois o cliente escreveu de novo.
- Deploy de `iago-atendimento`. Sem custo extra além da mensagem normal.

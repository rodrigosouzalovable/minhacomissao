# Botão "Custo no mês" vira só ícone

## O que muda
No cabeçalho da conversa do Inbox Meta Oficial, o botão "Custo no mês: R$ 0,04" passa a ser um botão quadrado apenas com o ícone de recibo, do mesmo tamanho dos outros ícones do cabeçalho.

- Um pequeno ponto no canto do ícone indica a situação: verde = valor confirmado, âmbar = aguardando confirmação.
- Ao passar o mouse, aparece a informação completa: "Custo no mês: R$ 0,04 · confirmado" (ou "· aguardando confirmação").
- Ao clicar, continua abrindo o extrato detalhado da conversa.

## Detalhes técnicos
- Arquivo: `src/components/inbox/meta/MetaConversationCost.tsx`.
- `Button size="icon"` `h-7 w-7`, com `Tooltip` do shadcn mostrando valor e status; ponto de status posicionado no canto.
- Sem mudanças de banco, consultas, cron ou custo de backend.

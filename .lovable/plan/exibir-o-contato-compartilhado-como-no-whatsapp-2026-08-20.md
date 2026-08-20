# Exibir o contato compartilhado como no WhatsApp

O contato que o cliente 62 99221-5752 enviou **já está gravado corretamente** no sistema: nome "Luzanira Novo" e telefone (62) 9963-8935, com tipo `contato`. O problema é apenas visual: na bolha da conversa aparece "Mídia indisponível" em vez do cartão de contato.

## Causa

No componente que desenha a bolha da mensagem existe uma regra genérica: "se o tipo não é texto e não tem arquivo de mídia, mostre 'Mídia indisponível'". Mensagens de contato não têm arquivo de mídia, então essa regra dispara antes de chegar no bloco que desenha o cartão de contato (que já existe e está pronto).

## O que muda

- Excluir o tipo `contato` (e demais tipos sem mídia por natureza) dessa regra genérica, de modo que a mensagem caia no bloco do cartão de contato.
- Resultado: a bolha passa a mostrar avatar, nome em destaque, telefone formatado `(62) 99638-8935` e os botões **Copiar** e **Conversar**, no estilo do WhatsApp — inclusive para a mensagem já recebida hoje, sem precisar reenviar nada.

## Detalhe técnico

- `src/components/inbox/ChatMessage.tsx`: no `renderContent`, o guard `tipo !== 'texto' && !mediaUrl` passa a ignorar `tipo === 'contato'` (alternativa equivalente: mover o bloco `tipo === 'contato'` para antes do guard).
- Nenhuma alteração de banco, webhook, cron ou realtime — zero impacto de custo.

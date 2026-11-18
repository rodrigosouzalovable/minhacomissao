# IAGO voltar a responder na caixa USA B2B

## Por que nao respondeu
A conversa da Passion Beauty Salon (15618366180) ficou marcada como "encerrada" em 16/11 as 16h08. Naquele dia chegou apenas a resposta automatica do WhatsApp Business do salao ("Thank you for contacting..."), e o IAGO tratou isso como robo e fechou a conversa. Hoje, as 14h28, a dona escreveu de verdade ("nao entendo, nao recebi nada"), mas como a conversa estava fechada, o IAGO ignorou sem responder.

## O que vou fazer
1. **Reabrir quando um humano escrever:** na caixa USA B2B, se a conversa estiver encerrada e chegar uma mensagem nova que nao seja resposta automatica nem recusa ("nao tenho interesse", "pare"), o IAGO reabre e responde uma vez, de forma curta, explicando por que entrou em contato.
2. **Recusa continua valendo:** quem recusou ou pediu para sair continua sem resposta. O limite de respostas por conversa (economia com a Meta) continua igual.
3. **Responder no idioma do cliente:** se o cliente escrever em portugues (como esta), o IAGO responde em portugues; em ingles, responde em ingles.
4. **Corrigir os casos parados:** reabrir agora as conversas da USA B2B fechadas apenas por resposta automatica e que ja receberam mensagem humana depois, incluindo a Passion Beauty Salon, e responder a elas uma unica vez.

## Detalhes tecnicos
- `iago-atendimento/index.ts`: no bloco `modoVendas`, quando `estado.etapa === 'vendas_encerrado'` e `mercadoUsa`, rodar `decidirParada` na mensagem atual; se o resultado for nulo ou `robo` nao se aplica (texto humano), voltar `etapa` para ativo e seguir o fluxo.
- Guardar o motivo do encerramento em `contexto.motivo_parada` para distinguir "robo" de "recusa" no futuro.
- Script pontual para reprocessar conversas USA B2B com `vendas_encerrado` e entrada posterior a ultima saida.
- Sem novo agendamento ou consulta periodica; custo extra apenas das respostas reabertas.

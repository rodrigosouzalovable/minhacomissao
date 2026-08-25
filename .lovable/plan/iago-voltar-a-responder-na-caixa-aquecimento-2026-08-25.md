# IAGO voltar a responder na caixa AQUECIMENTO

## O que foi verificado no banco

- As 17 instâncias UAZAPI ligadas à caixa AQUECIMENTO receberam mensagem do número **+55 15 55348-7840** entre 18:10 e 18:14 de hoje, uma por chip, com ~11 segundos de intervalo.
- Todas as conversas receberam a etiqueta do IAGO corretamente e o IAGO reservou cada mensagem para processar (`iago_conversa_estado` com trava marcada).
- Nenhuma dessas 17 conversas teve qualquer avanço: etapa continua `inicio`, nenhuma entrada foi concluída, nenhuma mensagem de saída foi gravada. Ou seja, **o atendimento começou e morreu no meio, sem resposta e sem registro do motivo**.
- No mesmo dia o IAGO respondeu normalmente conversas da API oficial (ex.: 18:02 e 15:16), então o motor em si está funcionando — a falha é específica desta rodada da caixa AQUECIMENTO.
- O conteúdo recebido é idêntico nas 17 conversas: uma mensagem promocional automática ("Olá, aqui é a Lisboa e Lima Comercio... sua conta foi criada..."), ou seja, um robô disparando para os nossos chips.
- Causa exata ainda não confirmada (os logs da hora da falha já expiraram). O que está confirmado é o efeito: quando algo falha depois da trava, a conversa fica abandonada, sem resposta e sem nova tentativa.

## O que será feito

1. **Nunca abandonar uma conversa**
   - Toda execução do IAGO passa a liberar a trava e registrar a falha, mesmo quando algo dá erro no meio.
   - Registro de falhas gravado no banco (motivo, contato, momento) para conseguirmos ver o problema depois, sem depender dos logs temporários.

2. **Nova tentativa automática**
   - Se a geração da resposta falhar (indisponibilidade/limite momentâneo de IA), o IAGO tenta novamente uma vez, com pequeno intervalo.
   - Se falhar de novo, a conversa recebe a etiqueta "Aguardando Humano" em vez de ficar silenciosa e invisível — assim nada mais fica parado sem ninguém saber.

3. **Rajadas de mensagens não derrubam mais o atendimento**
   - Quando o mesmo número escreve para vários chips quase ao mesmo tempo, as execuções passam a ser espaçadas, evitando estouro de limite de IA.
   - Continua respondendo cada conversa, uma por chip, mas em sequência controlada.

4. **Robô/propaganda não gera atendimento inútil**
   - Mensagem claramente automática de divulgação em massa (texto promocional repetido para vários chips, com link/convite de cadastro) não recebe negociação: a conversa é marcada para revisão humana e a entrada é concluída normalmente.
   - Mensagem de cliente de verdade continua sendo atendida sempre, como já é hoje.

5. **Destravar agora as 17 conversas de hoje**
   - Liberar as travas presas e deixá-las prontas para atendimento na próxima mensagem do contato.

## Detalhes técnicos

- `supabase/functions/iago-atendimento/index.ts`: envolver o corpo após `iago_claim_message` em `try/finally` que sempre chama `iago_finish_message` (ou libera `processando_em`); no `catch`, gravar falha e aplicar etiqueta "Aguardando Humano" após a segunda tentativa.
- `supabase/functions/_shared/iago.ts`: `chamarIA` com 1 retry (backoff curto) e modelo de reserva em caso de `rate_limit`.
- Espaçamento das rajadas: jitter aleatório antes da trava proporcional ao número de execuções simultâneas do mesmo telefone (sem cron, sem polling).
- Detecção de divulgação em massa: reforçar `ehRespostaAutomatica` com padrões de propaganda + verificação de mesmo texto recebido em outras instâncias na última hora.
- Nova tabela pequena `iago_falhas` (contato_id, entrada_id, motivo, criado_em) com RLS admin-only e GRANTs; sem processamento recorrente, custo praticamente zero.
- SQL pontual para limpar `contexto->processando_em` das conversas travadas.

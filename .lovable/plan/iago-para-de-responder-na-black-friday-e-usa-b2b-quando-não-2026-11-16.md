# IAGO para de responder na Black Friday (e USA B2B) quando não há interesse

## O que muda
Nas caixas BLACK FRIDAY e USA B2B, o IAGO deixa de responder em definitivo quando perceber qualquer um destes casos:
- **Sem interesse:** a empresa recusa, diz que não precisa, pede para parar ou não compartilha lista de clientes.
- **Robô/atendente virtual do outro lado:** menus ("digite 1"), respostas automáticas, "não consigo confirmar mensagens", texto genérico de assistente ou respostas que se repetem.
- **Conversa sem progresso:** a empresa já recebeu muitas respostas e não mostrou interesse.

Depois de encerrar, o IAGO não manda mais nada para aquele contato, nem a frase de despedida. Novas mensagens do contato ficam no Inbox para você ler, sem resposta automática e sem custo.

Se a empresa demonstrar interesse real (pergunta preço, pacotes, quer fechar), a conversa continua e você recebe o aviso no WhatsApp, como hoje.

## Limites de segurança
- No máximo **4 respostas do IAGO por conversa** sem interesse demonstrado. Ao chegar a 4, ele para.
- No máximo **1 resposta a cada 2 minutos** por conversa, para que dois robôs não fiquem trocando mensagens em sequência.
- Conversas já em andamento (como a Rios Advogados) também passam a obedecer a essas regras na próxima mensagem que chegar.

## Detalhes técnicos
- `iago-atendimento` (modoVendas): a IA também devolve `encerrar: true` e `motivo_encerramento` (`sem_interesse` | `robo` | `sem_progresso`). Não envia nada quando `encerrar` vem marcado.
- Uma regra de código detecta padrões de robô (menus numerados, "assistente virtual", "mensagem automática", texto repetido) antes de chamar a IA, para não gastar com a IA.
- Contagem de respostas e horário da última resposta vêm das mensagens de saída da própria conversa. Também verifica se a conversa já foi encerrada em `iago_conversa_estado.etapa = 'vendas_encerrado'`.
- Quando para, grava `etapa = 'vendas_encerrado'` no estado da conversa. Depois disso, toda chamada para esse contato retorna `skipped` logo no início.
- Os prompts de Goiânia (`index.ts`) e USA (`_shared/vendas-usa.ts`) mudam: nada de despedida, encerrar em silêncio.
- Nenhuma tabela, rotina agendada ou consulta periódica nova. O custo da Cloud não aumenta e o gasto com a Meta diminui.
- Teste Deno para o detector de robô e para o limite de 4 respostas.

# Inbox Meta Oficial: conversas com resposta do cliente nunca podem desaparecer

## O que eu verifiquei no banco

1. **A conversa relatada foi apagada, não arquivada.** Existem 5 mensagens **de entrada** do cliente (556493361514, "BEATRIZ CONCEICAO DOS SANTOS, CPF 068328415...", pedindo os boletos do mês) em 07/08, na instância `b103ac3e…`, e **não existe mais nenhum contato/conversa correspondente**. As mensagens ficaram no banco; o registro da conversa não. Esse é o único caso de conversa apagada nos últimos 20 dias.
2. **A tela do Inbox tem exclusão definitiva.** O menu de contexto da conversa apaga a linha do contato de forma permanente (individual e em lote, para qualquer usuário). Foi isso que fez a conversa "sumir" da caixa Padrão.
3. **A rotina de retenção não é a culpada neste caso**, mas hoje está mais agressiva do que o combinado: ela roda de hora em hora e arquiva com **24h** (o combinado era 3 dias) e decide apenas pelo campo `ultima_msg_entrada_em`, sem conferir se existem mensagens de entrada reais. Hoje há 10.786 conversas arquivadas e apenas 1 delas tem resposta do cliente — ou seja, a regra está funcionando, mas sem rede de proteção.
4. **A busca não encontra conversas arquivadas.** Quem procura na aba "Conversas" nunca vê o que foi arquivado, o que reforça a sensação de conversa perdida.

## O que será feito

**1. Restaurar a conversa da cliente Beatriz (556493361514)**
- Recriar a conversa na caixa Padrão da instância correta, a partir das mensagens que já estão no banco, com a data da última mensagem recebida. Todo o histórico volta a aparecer no Inbox.
- Verificar se existe algum outro caso de mensagens sem conversa e restaurar da mesma forma.

**2. Acabar com o desaparecimento por exclusão**
- Conversa **com qualquer resposta do cliente** deixa de poder ser excluída: a opção passa a arquivar.
- Exclusão definitiva fica **restrita ao login de admin**, com confirmação explícita, e apenas para conversas sem nenhuma resposta do cliente. O mesmo vale para a exclusão em lote.

**3. Rede de proteção na retenção automática**
- Voltar o corte para **3 dias** após o último envio (como você definiu originalmente), mantendo a execução horária em lotes.
- Antes de arquivar, conferir nas mensagens se aquele cliente já respondeu alguma vez. Se houver qualquer mensagem de entrada, a conversa **não é tocada**, mesmo que o campo de controle esteja vazio.
- Continuam protegidas: fixadas, com não lidas e com etiqueta aplicada. Nada é apagado — arquivar é reversível e a conversa reaparece sozinha quando o cliente responde.

**4. Busca que enxerga tudo**
- Ao digitar na busca, a lista passa a incluir também as conversas arquivadas, com um indicativo "Arquivada" no card, para nenhuma conversa parecer perdida.

## Detalhes técnicos

- Restauração: `INSERT` em `meta_whatsapp_contatos` a partir de `meta_whatsapp_mensagens` (instância + telefone), preenchendo `ultima_mensagem`, `ultima_mensagem_em`, `ultima_msg_entrada_em`, `folder_id = NULL`, `arquivado = false`.
- Banco: política de `DELETE` em `meta_whatsapp_contatos` restrita a admin e a contatos com `ultima_msg_entrada_em IS NULL`; a UI (`src/pages/InboxMeta.tsx`, `MetaConversaContextMenu.tsx`) passa a arquivar nos demais casos.
- `supabase/functions/meta-inbox-retention/index.ts`: corte 24h → 72h e checagem extra em `meta_whatsapp_mensagens` (`direcao = 'entrada'`, mesma instância, sufixo de 8 dígitos) antes de arquivar cada lote.
- `src/pages/InboxMeta.tsx`: na busca server-side, remover o filtro `arquivado` fixo e sinalizar arquivadas no card.

## Custo Lovable Cloud

Impacto praticamente nulo: a retenção ganha uma consulta por lote (indexada) e roda menos vezes com efeito, e a busca só faz uma consulta extra quando o usuário digita. Nenhum novo cron, polling ou canal em tempo real.

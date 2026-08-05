# Etiqueta deve ser do atendente que iniciou a conversa (Inbox Meta)

## Causa confirmada (verificada no banco e no código)

Caso do print (ROCKBIS ISAIAS, 5592981587431):

- A mensagem de saída foi enviada com o texto começando em `*Atendente Wallace:*`, mas o registro da mensagem tem `user_id` = RODRIGO RIBEIRO DE SOUZA (quem disparou tecnicamente). Ou seja, o nome real do atendente está no texto, não no `user_id`.
- A etiqueta aplicada foi `Atendente: Thailinny Nolasco`, com `origem = auto_atendente` e horário igual ao da resposta do cliente. Ela veio do gatilho de banco `atribuir_atendente_fila`, que roda em cada mensagem recebida e escolhe pela **fila global por menor carga** — sem considerar quem iniciou a conversa. Thailinny está na fila (ordem 11) e ativa.
- O passo do webhook que deveria identificar "quem iniciou a conversa" está **quebrado**: ele consulta `meta_whatsapp_mensagens` por `contato_id`, coluna que não existe nessa tabela (as mensagens são ligadas por `instancia_id` + `telefone`). A consulta sempre falha, cai no catch e o webhook parte para o rodízio.

Resultado: quem responde ganha uma etiqueta sorteada, nunca a de quem acionou.

## O que será feito

### 1. Identificar corretamente quem iniciou a conversa

No webhook do Inbox Meta, ao receber resposta do cliente:

- Buscar a última mensagem de saída pelo par `instancia_id` + `telefone` (correção da consulta quebrada).
- Extrair o nome do atendente do texto quando a mensagem trouxer o prefixo `*Atendente <Nome>:*` — essa é a fonte mais confiável em disparos feitos pelo login de admin/campanha.
- Casar esse nome com a etiqueta `Atendente: ...` correspondente (aceitando nome parcial, ex.: "Wallace" → "Atendente: Wallace Maciel"; se houver mais de um nome compatível, não arrisca e ignora).
- Se não houver prefixo no texto, usar o `user_id` de quem enviou, como hoje.
- A etiqueta escolhida continua passando pelos filtros já existentes: permissão "Atende no Inbox Meta Oficial" e ser responsável pela caixa da conversa.

Ordem final de decisão: acordo lançado com o mesmo telefone → consulta de CPF no portal (7 dias) → **quem iniciou a conversa** → rodízio por menor carga (só se nada acima resolver).

### 2. Impedir que o sorteio da fila atropele o atendente real

O gatilho `atribuir_atendente_fila` passa a só sortear quando a conversa **não** foi iniciada por nós: se existir qualquer mensagem de saída anterior para aquele telefone/instância, o gatilho não etiqueta e deixa a decisão para o webhook (que agora identifica o iniciador). Conversas realmente novas, iniciadas pelo cliente, continuam entrando no rodízio da fila como hoje.

### 3. Corrigir o histórico recente

Nas conversas que hoje têm etiqueta automática de atendente divergente do atendente identificado no texto da última mensagem enviada (últimos 30 dias), trocar a etiqueta pela do atendente correto — respeitando a regra de uma única etiqueta de atendente por conversa. Conversas sem prefixo identificável ficam como estão.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: no bloco "Match por quem realmente iniciou/atendeu a conversa", trocar `.eq('contato_id', contatoIdFinal)` por `.eq('instancia_id', inst.id).eq('telefone', <telefone do contato>)`, selecionar também `conteudo`, e aplicar regex `^\*Atendente\s+(.+?):\*` para extrair o nome; resolver a etiqueta por igualdade exata e, na falta, por `startsWith` único entre as etiquetas `Atendente:%`. Manter `etiquetaElegivel` como filtro final.
- Migração do gatilho `public.atribuir_atendente_fila()`: adicionar um `EXISTS` sobre `meta_whatsapp_mensagens` (`instancia_id = NEW.instancia_id AND telefone = NEW.telefone AND direcao = 'saida'`) e retornar sem inserir quando verdadeiro.
- Correção de histórico via instruções de dados (sem alterar schema), usando `origem = 'auto_atendente'`.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo.

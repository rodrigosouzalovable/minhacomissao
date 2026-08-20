# IAGO pergunta e grava o nome do cliente

Hoje o IAGO usa o nome do perfil do WhatsApp (pushName) como se fosse o nome da pessoa. Quando o contato se chama "Deus E Fiel", ele chama o cliente de "Deus". A mudança faz o IAGO parar de confiar nesse nome de perfil, perguntar o nome quando não souber e guardar a resposta para usar no resto do atendimento e nos contatos futuros.

## Como vai funcionar

1. **Nome de perfil do WhatsApp deixa de ser tratado como nome real.** Nomes que claramente não são de pessoa (frases religiosas, nome de loja/empresa, apelidos com símbolos, mais de 3 palavras, palavras como "Deus", "Fiel", "Oficial", "Loja", "Contato", etc.) são descartados. O IAGO nunca cumprimenta com um nome vindo só do perfil.
2. **Nome vindo do cadastro continua valendo.** Se o telefone/CPF já está em um cadastro (devedores/acordos), o nome do cadastro é usado como hoje — inclusive a confirmação leve ("Falo com Matheus?").
3. **Quando não há nome confiável, o IAGO pergunta.** Na primeira ou segunda mensagem ele pede o nome de forma natural ("Antes de continuar, como você se chama?"), sem travar o atendimento: se o cliente já mandou o CPF ou a dúvida, ele responde e pede o nome na mesma leva de mensagens.
4. **A resposta é gravada.** Quando o cliente informa o nome, o IAGO extrai e salva; a partir daí passa a chamar o cliente pelo primeiro nome nas próximas mensagens, nos follow-ups e nos próximos contatos do mesmo telefone.
5. **Não insiste.** Se o cliente não quiser dizer o nome ou ignorar a pergunta, o IAGO segue o atendimento normalmente e não pergunta de novo (no máximo uma tentativa por conversa).
6. **Nome informado tem prioridade** sobre o nome de perfil, mas não sobre o nome do cadastro quando o CPF já foi identificado.

## Detalhes técnicos

`supabase/functions/_shared/iago.ts`:
- Novo helper `nomePerfilConfiavel(nome)`: rejeita nomes de perfil não pessoais (lista de palavras-bloqueio, >3 palavras, emojis/símbolos, tudo maiúsculo tipo razão social).
- Novo helper `extrairNomeInformado(texto)`: reconhece "meu nome é X", "sou o X", "aqui é X", "X" isolado em resposta ao pedido de nome; ignora CPF/números e frases longas.

`supabase/functions/iago-atendimento/index.ts`:
- `nomeCliente` passa a ser: `proposta?.nomeCliente || nomePorTelefone || contexto.nome_informado || (nomePerfilConfiavel(contato.nome) ? contato.nome : '')`.
- Ao receber mensagem, se `etapa` recente é o pedido de nome (ou não há nome) e `extrairNomeInformado` retorna algo, grava em `iago_conversa_estado.contexto.nome_informado` (campo jsonb já existente — sem migração) e atualiza `meta_whatsapp_contatos.nome` quando o valor atual for o pushName não confiável.
- Novo flag no contexto `nome_pedido: true` para não repetir a pergunta.
- No prompt de `gerarResposta`: quando não há nome confiável e `nome_pedido` é falso, instrução para pedir o nome de forma natural junto da resposta; quando há nome, instrução de usar o primeiro nome; proibição explícita de deduzir nome a partir do perfil do WhatsApp.

`supabase/functions/iago-followup-tick/index.ts`: usa o mesmo critério de nome confiável ao montar o texto de retomada.

Sem novo cron, sem polling e sem tabela nova — apenas campos dentro do `contexto` já existente.

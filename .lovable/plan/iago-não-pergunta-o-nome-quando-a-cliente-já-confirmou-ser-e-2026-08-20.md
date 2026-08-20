# IAGO não pergunta o nome quando a cliente já confirmou ser ela

No caso da cliente 61 98141-6422, a nossa primeira mensagem já trazia o nome completo ("Olá Mayara Janaina Vieira Tavares, para garantir a segurança do processo, precisamos confirmar que falamos com o titular da conta...") e ela respondeu "Bom dia / Sim". Mesmo assim o IAGO perguntou o nome dela.

O motivo: hoje o IAGO só considera nome confiável o que vem do cadastro (CPF/telefone), o que o cliente digitou, ou o nome do perfil do WhatsApp quando ele parece de pessoa. O nome que **nós mesmos** enviamos na abertura da conversa não é lido, então ele ficou sem nome e perguntou.

## O que vai mudar

1. **O IAGO passa a ler o nome que nós enviamos na conversa.** Ao montar o atendimento, ele procura no histórico de saída o nome usado na saudação (ex.: "Olá Mayara Janaina Vieira Tavares," / "Bom dia, Mayara,") e passa a tratá-lo como nome do cliente.
2. **Confirmação de identidade encerra o assunto.** Se a última mensagem do cliente for uma confirmação ("sim", "sou eu", "sou ela", "isso", "correto", "é comigo mesmo") e já existir um nome enviado por nós, esse nome é gravado como confirmado e o IAGO nunca mais pergunta o nome nessa conversa.
3. **Nada de pergunta redundante.** Com nome conhecido (cadastro, confirmado ou enviado por nós), a instrução de pedir o nome deixa de ser enviada para a IA e o IAGO segue direto para o atendimento, chamando a pessoa pelo primeiro nome.
4. **Se a pessoa negar** ("não sou", "número errado"), o comportamento atual continua igual: encerramento educado e escalada para humano.

## Detalhes técnicos

`supabase/functions/_shared/iago.ts`
- Novo helper `nomeDeSaudacaoEnviada(historico)`: extrai o nome próprio das mensagens de saída ("Olá X,", "Bom dia, X," , "Oi X"), descartando trechos que não são nome (frases longas, palavras de sistema, valores).
- Novo helper `ehConfirmacaoIdentidade(texto)`: reconhece confirmações curtas ("sim", "sou eu", "sou ela/ele", "isso", "isso mesmo", "correto", "positivo", "é comigo").

`supabase/functions/iago-atendimento/index.ts`
- Após montar o histórico, calcula `nomeEnviadoPorNos = nomeDeSaudacaoEnviada(historico)`.
- Se `ehConfirmacaoIdentidade(textoAtual)` e houver `nomeEnviadoPorNos`, grava `contexto.nome_informado = nomeEnviadoPorNos` e `contexto.nome_pedido = true` (sem migração — campos jsonb já existentes) e corrige `meta_whatsapp_contatos.nome` quando o salvo for só o pushName não confiável.
- `nomeCliente` passa a incluir `nomeEnviadoPorNos` na cadeia de prioridade: cadastro > nome informado/confirmado > nome enviado por nós > perfil confiável.
- `precisaPerguntarNome` volta a ser falso nesses casos, logo o prompt não pede o nome.

`supabase/functions/iago-followup-tick/index.ts`
- Usa o mesmo critério (nome confirmado/enviado por nós) ao montar o texto de retomada.

Sem novo cron, sem polling e sem tabela nova — apenas leitura do histórico já carregado.

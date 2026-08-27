# Caixa AQUECIMENTO: IAGO responde sempre, sem chamar humano

## O que foi verificado

Na caixa **AQUECIMENTO** as conversas estão recebendo a etiqueta "Aguardando Humano" junto com "Atendente: Iago Ribeiro de Souza" — ou seja, o IAGO está escalando para atendimento humano e, a partir daí, para de responder (o estado `aguardando_humano` bloqueia as respostas seguintes).

Os pontos que hoje geram esse bloqueio no atendimento do IAGO são: mídia sem texto legível, pedido de bloqueio de contato, cliente que já tem acordo, comprovante de pagamento, assuntos proibidos, dúvida da IA, falha técnica da IA e a decisão `escalar` do modelo.

## O que será feito (somente na caixa AQUECIMENTO)

- **Modo aquecimento**: quando a conversa estiver na caixa AQUECIMENTO, o IAGO nunca escala para humano. Isso vale para todos os caminhos acima: ele sempre responde algo curto e natural e segue a conversa.
- A etiqueta "Aguardando Humano" deixa de ser aplicada nessa caixa, e o estado da conversa nunca fica travado esperando humano.
- Os avisos ao admin/contatos de emergência sobre "preciso de um humano" não são disparados para conversas dessa caixa (evita ruído, já que é conversa de aquecimento).
- Quando a IA não conseguir formular resposta (falha técnica), o IAGO envia uma resposta curta genérica de continuidade em vez de silenciar — a conversa nunca fica sem resposta.
- Follow-ups continuam funcionando normalmente para manter o fluxo de mensagens.
- Exceção mantida por segurança: se o contato pedir para não receber mais mensagens (opt-out), o IAGO encerra educadamente e para de escrever para aquele número — mas sem chamar humano.
- **Limpeza retroativa**: remover a etiqueta "Aguardando Humano" das conversas atuais da caixa AQUECIMENTO e destravar o estado dessas conversas, para o IAGO voltar a responder nelas.

As demais caixas (Padrão, AMARAL, AMARAL NM, ODRES, etc.) continuam exatamente como estão, com escalonamento normal para humanos.

## Detalhes técnicos

- `supabase/functions/iago-atendimento/index.ts`: derivar `modoAquecimento = contato.folder_id === FOLDER_AQUECIMENTO_INBOX` (constante já existente em `_shared/iago.ts`) e usá-la para:
  - pular `etiquetarAguardandoHumano` e `avisarEmergencia` (linhas ~231, 303, 347, 387, 616, 775, 824-830, 878);
  - forçar `aguardando_humano: false` e `etapa` de conversa nos updates de estado (~297, 339, 379, 614, 764, 799);
  - forçar `escalar = false` após a chamada da IA (~666-735) e, quando `mensagens` vier vazio, usar uma resposta curta de continuidade;
  - no bloco de mídia sem texto legível (~227-236), responder uma frase curta em vez de escalar.
- Prompt da IA (`montarPrompt`, ~1049): no modo aquecimento, instruir explicitamente "nunca escale, sempre responda; não mencione especialista/colega/transferência" e usar `escalar=false` sempre.
- Manter `ehOptOut`/`suprimirDestinatario` ativos; manter `ehNumeroErrado`/`ehFalecido` encerrando a conversa, mas sem etiqueta nem aviso.
- Limpeza de dados (instrução SQL, sem mudança de schema): remover vínculos da etiqueta "Aguardando Humano" dos contatos com `folder_id` da caixa AQUECIMENTO e `UPDATE iago_conversa_estado SET aguardando_humano = false` para esses contatos.
- Redeploy de `iago-atendimento`. Sem cron, polling ou Realtime novos — nenhum impacto de custo.


Objetivo: corrigir o Inbox para que a conversa mostre todo o histórico possível, sem dizer “não há mensagens antigas” quando elas existem.

O que encontrei
- A função atual `fetch-whatsapp-history` está chamando `POST /chat/getMessages`.
- Nos logs, esse endpoint responde `405 Method Not Allowed` repetidamente.
- Nas referências da UAZAPI V2 que conferi, esse endpoint não aparece no conjunto principal de endpoints usados pelo projeto.
- Além disso, o frontend hoje busca no banco só `100` mensagens (`WhatsAppInbox.tsx`), então mesmo que já exista histórico salvo no banco, ele não aparecerá inteiro.
- Para áudio/imagem antigos, a função atual também não salva `media_url`, então mesmo quando importar, mídias antigas podem continuar indisponíveis.

Plano de correção
1. Corrigir a origem do histórico
- Revisar a integração da edge function para usar o endpoint realmente suportado por esta instância da API, em vez de insistir em `/chat/getMessages`.
- Testar as variações válidas de autenticação e rota já compatíveis com esse provedor.
- Se a API dessa instância realmente não expuser histórico de mensagens antigas, o sistema deve parar de prometer essa restauração e passar a informar isso corretamente.

2. Ajustar a edge function para importação real
- Reescrever `fetch-whatsapp-history` para:
  - usar o endpoint suportado;
  - interpretar corretamente texto, áudio, imagem, vídeo e documento;
  - deduplicar de forma mais confiável;
  - retornar um resultado claro: importadas, já existentes, mídia indisponível, endpoint não suportado.
- Reaproveitar a lógica já existente de tratamento de mídia do fluxo de webhook, quando houver `messageId` suficiente para tentar recuperar arquivos.

3. Exibir todo o histórico já salvo no banco
- Remover o gargalo atual de `.limit(100)` no carregamento da conversa.
- Implementar carregamento progressivo/paginação no chat:
  - carregar as mensagens mais recentes primeiro;
  - ao subir a conversa, buscar blocos anteriores;
  - manter ordenação correta por `timestamp_msg`.
- Isso resolve dois casos:
  - conversas já antigas que já estão no banco;
  - conversas que receberem histórico importado em lotes.

4. Melhorar a UX do botão do relógio
- O botão não deve mais mostrar “nenhuma mensagem nova encontrada” quando, na verdade, houve falha de integração.
- Separar os estados:
  - histórico importado;
  - conversa já estava completa no banco;
  - API não suporta histórico;
  - erro temporário de comunicação.
- Mostrar toast/mensagem coerente com o resultado real.

5. Garantir compatibilidade com mídias antigas
- Para mensagens antigas de áudio/imagem/documento:
  - se a API devolver URL ou permitir download por `messageId`, salvar `media_url`;
  - se não devolver mídia recuperável, exibir a mensagem textual corretamente sem quebrar a conversa.
- Para áudio antigo, integrar com o fluxo já usado no projeto para download/normalização de mídia quando possível.

Arquivos que devem ser ajustados
- `supabase/functions/fetch-whatsapp-history/index.ts`
- `src/pages/WhatsAppInbox.tsx`
- possivelmente reaproveitar partes de:
  - `supabase/functions/whatsapp-chatbot/index.ts`
  - `src/components/inbox/ChatMessage.tsx`

Detalhes técnicos
- Não vejo necessidade imediata de mudar RLS para esse conserto.
- O principal problema hoje não é permissão: é endpoint incorreto + limite de 100 mensagens no frontend.
- Se a API de histórico suportar identificador único de mensagem, a implementação ideal é persistir esse identificador para deduplicação melhor do que `timestamp + conteúdo + direção`.

Resultado esperado após a implementação
- Se o provedor permitir histórico: ao clicar no relógio, o chat importa e mostra mensagens antigas reais, inclusive em lotes maiores.
- Se o histórico já estiver salvo no banco: o usuário conseguirá navegar por toda a conversa, não só pelas últimas 100 mensagens.
- Se a API não oferecer histórico retroativo nessa instância: o sistema deixará isso explícito e o botão não dará falso negativo.

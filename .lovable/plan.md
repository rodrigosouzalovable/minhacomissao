
Objetivo: fazer o WhatsApp Inbox salvar e exibir a imagem original em alta qualidade, usando thumbnail só como último fallback real.

O que encontrei no código atual
- `supabase/functions/whatsapp-chatbot/index.ts` já tenta a ordem UAZAPI -> fetch direto -> thumbnail, mas a validação está fraca: qualquer blob/json minimamente válido pode ser salvo como “sucesso”.
- A checagem `isTinyImageBlob()` hoje só gera aviso quando a origem é `thumbnail`; ela não rejeita miniaturas/preview vindas da própria UAZAPI ou da URL direta.
- O webhook já recebe campos importantes no payload (`messageid`, `content.URL`, `mimetype`, `fileLength`, `mediaKey`, `directPath`, `width`, `height`), mas eles não estão sendo usados para validar qualidade nem para fallback robusto.
- `src/components/inbox/ChatMessage.tsx` está com a prioridade do lightbox invertida: usa `msg.media_url || blobUrl`, quando deveria priorizar `blobUrl` para manter consistência com a imagem carregada no chat.

Plano de correção
1. Refatorar o download da mídia no `whatsapp-chatbot`
- Extrair helpers para:
  - normalizar `messageId` (raw + clean sem prefixo);
  - baixar mídia original via UAZAPI;
  - baixar via URL direta/CDN;
  - decodificar thumbnail apenas como fallback final;
  - validar se o blob recebido é realmente “original” ou só preview.
- Centralizar a decisão em um fluxo único, para impedir que preview/thumbnail sejam aceitos cedo demais.

2. Endurecer a prioridade real do download
```text
UAZAPI original
  -> URL direta/CDN (com suporte a .enc quando necessário)
    -> JPEGThumbnail (último caso)
```
- A etapa UAZAPI vai tentar os endpoints relevantes com `POST` e `messageId` limpo e bruto.
- Se necessário, a chamada será testada com os formatos de header aceitos pela UAZAPI (`token` e/ou `Authorization: Bearer ...`) sem quebrar o padrão atual do projeto.
- `chat/getMessageById` ficará só como apoio de diagnóstico/metadados, não como fonte principal de imagem final.

3. Bloquear thumbnails disfarçados de original
- Antes de salvar no storage, validar:
  - `blob.size`
  - dimensões reais da imagem
  - `mimetype`
  - comparação com metadados do payload (`fileLength`, `width`, `height`) quando existirem
- Rejeitar como “original” qualquer imagem pequena/miniatura mesmo que venha da UAZAPI JSON, UAZAPI binary ou fetch direto.
- Só permitir `thumbnail` quando as duas etapas anteriores falharem de verdade.

4. Implementar fallback robusto da URL direta
- Usar `content.URL` / `imageLink` / `mediaUrl` / `directPath` quando disponíveis.
- Se a URL for arquivo criptografado `.enc`, preparar o fallback com descriptografia local usando os dados do payload (`mediaKey`, `directPath`, `fileEncSHA256`, etc.) em vez de salvar o preview.
- Salvar no storage exatamente o blob original, sem resize, sem recompressão e preservando o MIME correto.

5. Melhorar os logs de diagnóstico
- Adicionar logs estruturados como:
  - `messageId bruto/limpo`
  - endpoint tentado
  - header mode usado
  - status HTTP
  - content-type retornado
  - tamanho do blob
  - dimensões detectadas
  - motivo de rejeição
  - estratégia vencedora (`uazapi-original`, `cdn-direct`, `thumbnail`)
- Isso vai permitir identificar rapidamente se a UAZAPI está devolvendo preview em vez do original.

6. Ajustar o lightbox no frontend
- Em `ChatMessage.tsx`, trocar a prioridade para `blobUrl || msg.media_url`.
- Assim o lightbox usa a mesma imagem já validada/carregada no chat, evitando inconsistência entre miniatura e tela cheia.

7. Validação pós-implementação
- Enviar uma nova imagem para o número conectado.
- Confirmar no banco que a nova `media_url` aponta para um arquivo substancialmente maior que thumbnail.
- Confirmar no Inbox:
  - miniatura nítida no chat;
  - imagem nítida ao expandir;
  - mesma qualidade da enviada no WhatsApp.
- Se a UAZAPI continuar devolvendo preview, a etapa seguinte será confirmar o endpoint/formato correto e manter o fallback por descriptografia do CDN como solução definitiva, sem aceitar thumbnail como padrão.

Detalhes técnicos
- Arquivos afetados:
  - `supabase/functions/whatsapp-chatbot/index.ts`
  - `src/components/inbox/ChatMessage.tsx`
- Não vejo necessidade de migration de banco para a correção principal.
- A infraestrutura atual de storage e autenticação pode ser mantida como está.

Resultado esperado
- O sistema deixa de salvar preview/thumbnail como se fosse original.
- O Inbox passa a abrir a imagem recebida com qualidade real, inclusive no lightbox.
- O thumbnail continua existindo apenas como contingência extrema, nunca como caminho normal.

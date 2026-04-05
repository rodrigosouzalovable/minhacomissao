
Objetivo: corrigir definitivamente a qualidade das imagens recebidas no WhatsApp Inbox implementando descriptografia local do arquivo `.enc` quando a UAZAPI não devolver o original.

O que já existe hoje
- `supabase/functions/whatsapp-chatbot/index.ts` já faz:
  1. tentativa via UAZAPI,
  2. fetch direto,
  3. thumbnail por último.
- O gargalo atual é que ainda não existe a etapa de descriptografia local com `mediaKey`.
- `src/components/inbox/ChatMessage.tsx` já está priorizando `blobUrl || msg.media_url`, então o principal ajuste agora é no backend.

Plano atualizado
1. Extrair metadados completos da mídia
- Ler e normalizar, a partir do payload:
  - `messageId` bruto e limpo
  - `content.URL`, `imageLink`, `mediaUrl`, `directPath`
  - `mimetype`, `fileLength`, `width`, `height`
  - `mediaKey`, `fileEncSHA256`
- Centralizar isso em um helper único para evitar variações de campo.

2. Reorganizar o fluxo de download
```text
UAZAPI /download-media
  -> UAZAPI /chat/getMessageById (se ajudar com URL/metadados)
    -> fetch do .enc + descriptografia local
      -> JPEGThumbnail como último recurso
```
- A UAZAPI continua sendo tentada primeiro.
- Se ela devolver preview, blob pequeno ou JSON inconsistente, o código não salva.
- A terceira etapa vira o fallback principal real: descriptografar o arquivo original baixado do CDN.

3. Implementar descriptografia local do arquivo `.enc`
- Baixar o binário criptografado da URL do WhatsApp.
- Decodificar `mediaKey` de base64.
- Derivar as chaves com HKDF usando o contexto correto do tipo de mídia:
  - imagem: `WhatsApp Image Keys`
  - vídeo: `WhatsApp Video Keys`
  - áudio: `WhatsApp Audio Keys`
  - documento: `WhatsApp Document Keys`
- Usar AES-CBC para descriptografar.
- Remover padding.
- Validar integridade do resultado comparando tamanho, assinatura do arquivo e, quando possível, `fileEncSHA256`/MAC esperado.
- Salvar exatamente o blob descriptografado, sem resize e sem recompressão.

4. Endurecer a validação de “original”
- Só aceitar blob como original se passar por:
  - `blob.size`
  - tipo MIME real
  - magic bytes do arquivo
  - dimensões detectadas
  - comparação com `fileLength`, `width` e `height` do payload
- Rejeitar qualquer retorno da UAZAPI que seja thumbnail disfarçado de original.

5. Melhorar logs de diagnóstico
- Padronizar logs como:
  - `[MEDIA] messageId bruto/limpo`
  - `[MEDIA] fileLength do payload`
  - `[MEDIA] URL .enc disponível`
  - `[MEDIA] mediaKey disponível`
  - `[MEDIA] tentativa UAZAPI`
  - `[MEDIA] tentando descriptografia local`
  - `[MEDIA] descriptografia sucesso/falha`
  - `[MEDIA] tamanho após descriptografia`
  - `[MEDIA] estratégia vencedora: uazapi | local_decrypt | thumbnail`
- Isso vai mostrar claramente se a UAZAPI está devolvendo preview e se o decrypt local resolveu.

6. Preservar o comportamento do frontend
- Não há mudança estrutural nova no `ChatMessage.tsx`.
- O foco é garantir que `media_url` já aponte para o arquivo original salvo no storage.

7. Validação pós-implementação
- Receber uma nova imagem no número conectado.
- Confirmar que o arquivo salvo é muito maior que thumbnail e compatível com `fileLength`.
- Confirmar no Inbox:
  - imagem nítida no chat,
  - imagem nítida ao expandir,
  - mesma qualidade percebida da enviada no WhatsApp.
- Se a UAZAPI continuar falhando, o sistema ainda deve funcionar com `local_decrypt` como estratégia vencedora, sem depender do thumbnail.

Detalhes técnicos
- Arquivo principal: `supabase/functions/whatsapp-chatbot/index.ts`
- `ChatMessage.tsx` só precisa ser revisto se surgir inconsistência nova; pelo estado atual, o problema não parece estar mais nele.
- Não vejo necessidade de migration de banco.
- Ponto importante: a derivação de chave precisa usar o contexto correto por tipo de mídia; não basta um HKDF genérico único.

Resultado esperado
- O sistema deixa de depender da UAZAPI para obter a imagem original.
- Quando a API retornar thumbnail/preview, o webhook baixa o `.enc`, descriptografa localmente e salva o arquivo real.
- O thumbnail passa a ser apenas contingência extrema.



## Corrigir download de mídia recebida no WhatsApp Inbox

### Diagnóstico confirmado

Ao verificar o banco de dados, as duas imagens mais recentes recebidas (18:04 e 17:58) estão salvas com `media_url = NULL`, enquanto uma anterior (17:49) tem URL válida. Isso confirma que o download da mídia pelo webhook está falhando silenciosamente em alguns casos.

Dois problemas identificados no código:

1. **messageId errado para a UAZAPI**: O código usa `payload.message.id` que retorna o ID com prefixo do dono (ex: `556282199214:AC47ECC8B09E...`), mas o endpoint `/download-media` da UAZAPI espera apenas o `messageid` sem prefixo (ex: `AC47ECC8B09E...`). A inconsistência faz com que o download funcione às vezes e falhe em outras.

2. **Sem fallback do thumbnail**: A UAZAPI envia um campo `JPEGThumbnail` (base64) no payload de imagens que poderia ser usado como fallback quando o download falha, mas o código não aproveita isso.

### Solução

**Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`**

1. Usar `payload.message.messageid` (sem prefixo) ao chamar `/download-media`
2. Quando ambas estratégias de download falharem, usar o `JPEGThumbnail` do payload como fallback — decodificar o base64, salvar no storage e usar como `media_url`
3. Adicionar mais logs para identificar falhas futuras

**Arquivo: `src/components/inbox/ChatMessage.tsx`**

4. Quando `media_url` for null e `conteudo` for um fallback de mídia (ex: "📷 Imagem"), mostrar "Mídia indisponível" em vez do texto do conteúdo que parece um link clicável

### Detalhes técnicos

```text
Fluxo atual (falha):
  Webhook → messageId = "owner:HEXID" → POST /download-media → 404/erro
  → fallback fetch URL .enc → dados criptografados → validação falha
  → media_url = NULL salvo no banco

Fluxo corrigido:
  Webhook → messageId = "HEXID" → POST /download-media → blob OK → storage
  Se falhar → JPEGThumbnail base64 → blob → storage (thumbnail menor)
  Se tudo falhar → media_url = NULL (mantém comportamento atual)
```

### Arquivos a alterar
- `supabase/functions/whatsapp-chatbot/index.ts` — corrigir messageId e adicionar fallback thumbnail
- `src/components/inbox/ChatMessage.tsx` — melhorar exibição quando media_url é null


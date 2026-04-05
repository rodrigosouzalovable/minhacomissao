
## Corrigir abertura de imagem no WhatsApp Inbox e preparar teste de envio

### Diagnóstico provável
Pelo código atual e pelos logs, há dois pontos diferentes causando esse comportamento:

1. **Mídia recebida**: o webhook está salvando arquivos vindos da integração a partir de URLs `...mmg.whatsapp.net/...enc`, ou seja, mídia potencialmente **criptografada**, que o navegador não consegue abrir como imagem/áudio.
2. **Mídia exibida no inbox**: o componente `ChatMessage` tenta renderizar via `blobUrl`, mas:
   - não trata o erro real do `<img>` (`onError`)
   - ao clicar, ainda abre `msg.media_url` original, e não a URL corrigida em memória

### O que vou ajustar
1. **`supabase/functions/whatsapp-chatbot/index.ts`**
   - reforçar a lógica de mídia para **não considerar a URL `.enc` como imagem final pronta**
   - priorizar uma URL/arquivo já utilizável da integração antes de salvar no bucket
   - se a integração só entregar mídia criptografada, registrar isso claramente e salvar a mensagem como anexo com fallback seguro, em vez de quebrar a visualização

2. **`src/components/inbox/ChatMessage.tsx`**
   - adicionar `onError` no `<img>` para trocar automaticamente para fallback
   - quando existir `blobUrl`, usar essa URL também no clique/abertura da imagem
   - melhorar a normalização de MIME para imagem e áudio
   - evitar mostrar imagem “quebrada” dentro da conversa

3. **Fluxo de envio de imagem para teste**
   - revisar o fluxo do envio manual do inbox para garantir que a imagem enviada fique com URL e tipo corretos no histórico
   - depois da correção, validar um envio real para um número e confirmar:
     - preview no inbox
     - clique para abrir
     - persistência no histórico
     - funcionamento também para áudio e arquivos

### Arquivos principais
- `supabase/functions/whatsapp-chatbot/index.ts`
- `src/components/inbox/ChatMessage.tsx`
- possivelmente `src/components/inbox/ChatInputBar.tsx` se precisar reforçar metadados do arquivo enviado

### Detalhes técnicos
- O problema atual aparenta ser **mais do que Content-Type**: o log indica URL de mídia com extensão/rota **`.enc`**, o que sugere que parte da mídia recebida não está em formato diretamente renderizável.
- Mesmo quando a imagem é corrigida em memória com `blobUrl`, o clique ainda aponta para a `media_url` original; isso explica casos em que “aparece algo” mas **não abre ao clicar**.
- Não vejo necessidade de migração de banco para essa correção.

### Validação final
- Enviar uma imagem pelo inbox para um número de teste
- Receber uma imagem no mesmo chat
- Confirmar que:
  - a miniatura aparece
  - o clique abre corretamente
  - áudios reproduzem
  - documentos continuam abrindo normalmente

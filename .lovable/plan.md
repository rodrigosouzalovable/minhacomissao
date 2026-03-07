

# Adicionar envio de imagens no chat do CobMais

## O que será feito

Permitir que o usuário envie screenshots no chat para mostrar à IA onde clicar. A imagem será convertida em base64, enviada junto com a mensagem, e a IA (Gemini) receberá como conteúdo multimodal para interpretar visualmente.

## Mudanças

### 1. Frontend — `src/pages/AutomacaoCobMais.tsx`

- Adicionar state para imagem selecionada (`chatImage: string | null`) e um `<input type="file" accept="image/*">` oculto
- Adicionar botão de anexar imagem (ícone 📎 / `ImagePlus`) ao lado do input de texto
- Mostrar preview da imagem selecionada acima do input com botão de remover
- No `handleChatSend`: se houver imagem, enviar mensagem como array multimodal `[{type: "text", text}, {type: "image_url", image_url: {url: base64}}]`
- Nas mensagens do usuário no chat: renderizar imagens inline quando `msg.content` for array ou quando houver `msg.image`
- Atualizar tipo `ChatMsg` para suportar `image?: string`

### 2. Backend — `supabase/functions/chat-cobmais-knowledge/index.ts`

- Passar mensagens multimodais diretamente ao Gemini (já suporta content como array com `image_url`)
- Adicionar instrução no system prompt: "Quando o usuário enviar uma imagem/screenshot, analise visualmente e identifique elementos, botões e campos. Use essa informação para decidir a próxima ação."


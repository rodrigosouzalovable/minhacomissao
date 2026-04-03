

## Drag & Drop e Colar Imagens no WhatsApp Inbox

### Resumo
Adicionar suporte a arrastar arquivos (drag & drop) para a área de chat e colar imagens da área de transferência (Ctrl+V / Cmd+V) para envio direto ao cliente.

### Alterações

**Arquivo: `src/pages/WhatsAppInbox.tsx`**

1. Adicionar estado `dragOver` para controlar visual de feedback ao arrastar
2. Na div da área de mensagens (linha 375), adicionar handlers `onDragOver`, `onDragLeave`, `onDrop`
3. No `onDrop`, extrair o arquivo, validar (imagem ou PDF) e chamar uma função de upload
4. Mostrar overlay visual "Solte o arquivo aqui" quando `dragOver === true`

**Arquivo: `src/components/inbox/ChatInputBar.tsx`**

1. Extrair a lógica de upload de `handleFileChange` para uma função pública `handleFileSend(file: File)` que possa ser chamada externamente
2. Exportar essa função via prop callback ou via `useImperativeHandle` / `forwardRef`
3. Adicionar handler `onPaste` no Input (linha 129) para detectar imagens coladas da clipboard
4. No `onPaste`, verificar `e.clipboardData.files` — se contiver imagem, chamar `handleFileSend`

### Abordagem técnica

- **ChatInputBar** receberá uma nova prop `onFileReceived?: (file: File) => void` ou exporá o método via ref
- A abordagem mais simples: mover `handleFileChange` para aceitar um `File` diretamente, e criar uma nova prop `externalFile` ou expor `handleFileSend` via `forwardRef`
- **Drag & Drop**: handlers no container de chat em `WhatsAppInbox.tsx`, que repassa o arquivo para o `ChatInputBar`
- **Paste**: handler `onPaste` no `<Input>` dentro do `ChatInputBar`, capturando `clipboardData.items` do tipo `image/*`
- Overlay visual: borda tracejada azul com texto "Solte o arquivo aqui" sobre a área de mensagens


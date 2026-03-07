
# Adicionar suporte a colar imagens (Ctrl+V) no chat

## Mudança

### `src/pages/AutomacaoCobMais.tsx`

Adicionar um handler `onPaste` no `<Input>` do chat que intercepta `clipboardData`, verifica se há uma imagem (`items` com `type.startsWith('image/')`) e a converte para base64, setando no `chatImage` — exatamente o mesmo fluxo que já existe no `handleChatImageSelect`.

```tsx
// No Input do chat, adicionar:
onPaste={(e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file || file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => setChatImage(reader.result as string);
      reader.readAsDataURL(file);
      break;
    }
  }
}}
```

Uma única adição de ~12 linhas no `onPaste` do Input existente (linha ~1013).



## Abrir imagem em tamanho original ao clicar

### Problema
Ao clicar na imagem no chat, ela abre em uma nova aba via blob URL, mas aparece pequena porque o blob foi gerado a partir do thumbnail (fallback JPEGThumbnail que é uma imagem pequena ~100px). Além disso, mesmo para imagens em tamanho real, abrir em nova aba não oferece boa experiência.

### Solução
Implementar um **lightbox/modal** dentro do próprio Inbox que exibe a imagem em tamanho completo ao clicar, em vez de abrir em nova aba.

### Alterações

**`src/components/inbox/ChatMessage.tsx`**:
1. Adicionar estado `showLightbox` para controlar a exibição do modal
2. Substituir o `<a href={blobUrl} target="_blank">` por um `onClick` que abre o lightbox
3. Renderizar um overlay escuro fullscreen com a imagem usando `object-contain` e `max-w-[90vw] max-h-[90vh]` para exibir no tamanho original respeitando a tela
4. Clicar no overlay ou pressionar Escape fecha o lightbox
5. Manter a miniatura no chat com `max-w-[250px]` como está

O lightbox usará um portal (`fixed inset-0 z-50 bg-black/90`) com a imagem centralizada em tamanho real, e um botão X para fechar.


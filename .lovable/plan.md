

## Barra de scroll sutil na sidebar

### Problema
A barra de scroll padrao do navegador na area de navegacao da sidebar esta muito visivel e esteticamente ruim.

### Solucao

**Arquivo:** `src/components/layout/AppLayout.tsx`

Substituir o `overflow-y-auto` por um componente `ScrollArea` do Radix (ja disponivel no projeto em `src/components/ui/scroll-area.tsx`), que renderiza uma scrollbar customizada e sutil.

1. Importar `ScrollArea` de `@/components/ui/scroll-area`
2. Substituir a div `flex-1 overflow-y-auto px-4` por `ScrollArea` com `className="flex-1"`
3. Mover o `px-4` para dentro do conteudo da ScrollArea

**Arquivo:** `src/components/ui/scroll-area.tsx`

Ajustar o estilo do thumb da scrollbar para ser mais sutil:
- Reduzir largura de `w-2.5` para `w-1.5`
- Usar cor semi-transparente (`bg-white/20`) em vez de `bg-border`
- Adicionar `hover:bg-white/40` para feedback ao passar o mouse
- Remover a borda lateral (`border-l-transparent`)


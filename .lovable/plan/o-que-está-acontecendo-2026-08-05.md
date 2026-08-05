Barra de rolagem no submenu de etiquetas do Inbox Meta

## O que está acontecendo

No Inbox Meta Oficial, ao clicar com o botão direito numa conversa e abrir **Etiquetas**, o submenu renderiza todas as etiquetas em uma lista única sem limite de altura. Como existem muitas etiquetas (várias de atendentes), o submenu ultrapassa a margem inferior da tela, impedindo que o usuário veja e clique nas etiquetas que ficaram fora da viewport.

## O que será feito

Adicionar uma barra de rolagem intuitiva e discreta no submenu de etiquetas, respeitando o design do shadcn/ui:

- Limitar a altura máxima do submenu de etiquetas a aproximadamente `70vh` (ou um valor fixo confortável, ex.: `max-h-[420px]`) para garantir que caiba na viewport.
- Usar o componente `ScrollArea` do projeto para envolver a lista de etiquetas, mantendo a barra de rolagem fina e sutil já utilizada em outros diálogos.
- Manter o item **"Gerenciar etiquetas"** acessível no final do submenu (dentro ou imediatamente após a área rolável).
- Preservar o comportamento atual: clique aplica/remove a etiqueta, ícone de cadeado para etiquetas bloqueadas, e ícone de check para etiquetas ativas.

## Detalhes técnicos

- Arquivo: `src/components/inbox/meta/MetaConversaContextMenu.tsx`
- Alterar a estrutura interna do `<ContextMenuSubContent className="w-56">` de etiquetas:
  - Importar `ScrollArea` de `@/components/ui/scroll-area`.
  - Aplicar `className="max-h-[420px] flex flex-col"` no `ContextMenuSubContent` (ou similar conforme teste visual).
  - Envolver os itens de etiqueta em `<ScrollArea className="flex-1">`.
  - Garantir que o separador e o botão "Gerenciar etiquetas" permaneçam visíveis.
- Sem mudanças no banco, sem Edge Function, sem impacto em custo.

## Teste visual

- Abrir o submenu "Etiquetas" em uma conversa com muitas etiquetas.
- Verificar que a lista rola para cima e para baixo com a barra fina do shadcn/ui.
- Confirmar que a última etiqueta e o botão "Gerenciar etiquetas" permanecem acessíveis.
- Confirmar que a aplicação/remoção de etiquetas continua funcionando.

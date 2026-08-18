# Campo de digitação do Inbox Meta: crescimento automático + redimensionar arrastando

## Objetivo
1. O campo de digitação deve realmente crescer conforme o texto quebra linhas (até 4 linhas por padrão), em vez de ficar travado em ~2 linhas com scroll.
2. Liberar o redimensionamento manual: o usuário arrasta a borda superior do campo para cima/baixo e define a altura que quiser.

## Diagnóstico (a confirmar na implementação)
O auto-resize atual já existe em `MetaComposer`, mas na prática o campo aparece com 2 linhas e scrollbar (conforme o print). Causa provável, ainda não confirmada: o `scrollHeight` é medido antes do layout final (o campo divide espaço em um container flex) e/ou o cálculo do limite fica abaixo de 4 linhas reais. Primeiro passo da implementação: medir a altura real de linha/padding em runtime em vez de assumir 96px fixos, e só então aplicar a altura.

## Alterações (apenas frontend)

### `src/components/inbox/meta/MetaComposer.tsx`
- Auto-resize robusto:
  - Calcular o limite máximo a partir do estilo computado (`lineHeight`, `paddingTop/Bottom`, `borderWidth`) x 4 linhas, em vez do valor fixo `96`.
  - Rodar o ajuste em `onChange`, no `useEffect` do texto, ao montar e em `ResizeObserver` do próprio campo (para reagir a mudanças de largura, como abrir/fechar painéis).
  - Remover as classes `min-h`/`max-h` fixas que competem com a altura inline; controlar tudo via estilo inline.
  - Mostrar scroll interno apenas quando a altura desejada passar do limite atual.
- Redimensionamento manual pela borda de cima:
  - Adicionar uma alça fina (área de arraste ~6px) logo acima do campo, com cursor `ns-resize` e cor de token semântico.
  - `pointerdown` na alça captura o ponteiro; ao mover para cima aumenta a altura, para baixo diminui.
  - Limites: mínimo 1 linha, máximo ~50% da altura da janela.
  - Depois de arrastar, a altura escolhida passa a valer como novo teto (o auto-resize respeita esse teto até o usuário arrastar de novo).
  - Duplo clique na alça volta ao comportamento automático de 4 linhas.
  - Suporte a teclado na alça (setas para cima/baixo) e `aria-label` para acessibilidade.

### `src/pages/InboxMeta.tsx`
- Envolver o composer para que a alça e o campo formem uma coluna, mantendo `items-end` nos botões laterais (anexo, áudio, enviar) para que continuem alinhados à base enquanto o campo cresce.
- Garantir que o crescimento empurre o campo para cima sem cortar a lista de mensagens.

## Validação
- Colar o texto longo do teste e confirmar crescimento progressivo até 4 linhas e scroll depois disso.
- Arrastar a borda de cima para cima e para baixo e confirmar altura ajustável e persistente durante a conversa.
- Confirmar reset para 1 linha após enviar.
- Verificar que Enter envia, Shift+Enter quebra linha, Escape cancela resposta e colar imagem continua funcionando.

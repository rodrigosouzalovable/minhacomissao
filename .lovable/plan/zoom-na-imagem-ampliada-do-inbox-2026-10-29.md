# Zoom na imagem ampliada do Inbox

Ao clicar numa imagem enviada pelo cliente (ex.: comprovante), a tela escura que abre passa a ter controles de zoom.

## O que muda
- Barra de botões no canto (ao lado do X): **Diminuir (−)**, **porcentagem atual** (ex.: 100%), **Aumentar (+)**, **Ajustar à tela** e **Baixar/abrir original**.
- **Ctrl + rodinha do mouse** (e pinça no touchpad) aumenta/diminui, mantendo o ponto sob o cursor parado.
- Rodinha sem Ctrl desloca a imagem quando ampliada; também é possível **arrastar** com o mouse.
- **Duplo clique** alterna entre ajustada à tela e 200%.
- Atalhos de teclado: `+`, `-`, `0` (ajustar), `Esc` (fechar).
- Zoom de 50% a 800%; ao abrir outra imagem volta a 100% ajustada.
- O zoom da página inteira do navegador não é acionado enquanto a imagem está aberta.

Nenhuma regra de mídia, download ou permissão muda — é só visualização.

## Detalhes técnicos
- Arquivo único: `src/components/inbox/ChatMessage.tsx` (lightbox existente via `createPortal`).
- Estado `zoom` + `offset`; `transform: translate() scale()` com `transform-origin: 0 0`.
- Listener nativo `wheel` com `{ passive: false }` + ref para evitar closure antiga; zoom por `Math.exp(-deltaY * 0.0015)` normalizando `deltaMode`.
- Arrasto via Pointer Events; `touch-action: none`.
- Sem custo de backend.

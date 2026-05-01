## Objetivo

No WhatsApp Inbox, o campo de digitação de mensagem hoje usa um `<Input>` (linha única), então textos longos rolam horizontalmente. Vamos trocar por um `<Textarea>` que cresce automaticamente conforme o usuário digita, até no máximo 4 linhas — depois disso, ativa scroll vertical interno.

## Arquivo afetado

- `src/components/inbox/ChatInputBar.tsx`

## Mudanças

1. **Trocar `Input` por `Textarea`** (`@/components/ui/textarea`) no campo de digitação principal.
2. **Auto-resize**: usar `useRef` no textarea + `useEffect` que recalcula `style.height`:
   - Reseta para `auto`, mede `scrollHeight`, aplica como height.
   - Limita a 4 linhas (≈ 4 × line-height; calcular dinamicamente via `lineHeight` computado, ou fixar `maxHeight: 96px` assumindo line-height ~24px).
   - Quando excede o máximo, define `overflow-y: auto`; abaixo, `overflow: hidden`.
3. **Comportamento de Enter**:
   - `Enter` (sem Shift) → envia mensagem (igual hoje).
   - `Shift+Enter` → quebra de linha (comportamento natural do textarea).
   - `Escape` → cancela resposta (igual hoje).
4. **Visual**: começar com 1 linha (`rows={1}`), padding e bordas iguais ao Input atual; `resize-none` para o usuário não arrastar manualmente; `flex-1` mantido.
5. **Reset de altura** após enviar (quando `textoMensagem` volta para `''`), para o textarea voltar a 1 linha.

## Detalhes técnicos

- Altura máxima: 4 linhas. Com `text-sm` (14px) e line-height ~20px + padding vertical (~8px topo + 8px base) ≈ `maxHeight: 96px`. Vou ajustar empiricamente, mas o cap principal é via `Math.min(scrollHeight, maxHeight)`.
- Manter `onPaste` (cola de imagem) e `disabled={isLoading}`.
- Botão de enviar/microfone permanece alinhado verticalmente (usar `items-end` no container do input para que os botões fiquem alinhados à base do textarea quando ele crescer).

## Fora do escopo

- Não mudar comportamento de envio, atalhos, gravação de áudio nem barra de respondendo/quick replies.

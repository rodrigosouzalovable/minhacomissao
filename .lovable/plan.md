# Ajuste da barra de digitação do Inbox Meta Oficial

## Objetivo
Fazer com que a caixa de digitação do Inbox Meta Oficial cresça automaticamente quando o texto quebrar linhas, limitando o crescimento a até 4 linhas, para melhor visualização da mensagem antes do envio.

## Escopo
Apenas frontend/presentation: alterar o componente `MetaComposer` e, se necessário, o container dele em `InboxMeta`.

## Alterações propostas

1. **Auto-resize no `MetaComposer.tsx`**
   - Adicionar `useEffect` que ajusta a altura do `textarea` com base no `scrollHeight`.
   - Definir altura mínima de ~1 linha (40-44 px) e máxima de ~4 linhas (96 px).
   - Quando o texto ultrapassar 4 linhas, exibir scrollbar vertical dentro do campo.
   - Resetar a altura para 1 linha após o envio da mensagem.

2. **Manter comportamentos existentes**
   - Preservar envio com `Enter` (sem `Shift`), `Shift+Enter` para quebra de linha, `Escape` para cancelar resposta e `onPaste`.
   - Preservar `disabled`, `enviando`, `placeholder`, `onSend`, `onEscape`, `initialText` e `onInitialTextConsumed`.

3. **Ajuste fino de layout no `InboxMeta.tsx` (se necessário)**
   - Verificar se o container `flex items-end` ao redor do composer continua alinhado corretamente quando o textarea cresce.
   - Garantir que os botões de anexo, áudio e envio não fiquem esticados ou desalinhados.

## Validação
- Typecheck/build do projeto.
- Teste visual no preview: digitar mensagem longa e confirmar que o campo cresce até 4 linhas e depois exibe scroll.
- Confirmar que mensagens de 1-3 linhas também crescem proporcionalmente.
- Confirmar que o campo volta a 1 linha após enviar.

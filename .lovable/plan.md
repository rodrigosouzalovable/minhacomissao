## Problema

Na aba **Modelo Mensagem**, os dois campos `% Desconto à vista` e `% Desconto parcelado` da página atualizam apenas os percentuais da **Mensagem 1** (`descVistaGlobal` / `descParceladoGlobal`).

A **Mensagem 2** é renderizada com variáveis separadas (`descVistaGlobal2` / `descParceladoGlobal2`), que vêm dos defaults salvos no editor e nunca mudam quando o usuário ajusta os campos na tela. Por isso `{desconto_vista_pct}` na Mensagem 2 continua zerado/com valor antigo.

## Correção

Arquivo: `src/pages/ModeloMensagem.tsx`

Fazer com que os dois inputs da página alterem **simultaneamente** os percentuais das duas mensagens:

- `onChange` do campo "% Desconto à vista" passa a chamar `setDescVistaGlobal(n)` **e** `setDescVistaGlobal2(n)`.
- `onChange` do campo "% Desconto parcelado" passa a chamar `setDescParceladoGlobal(n)` **e** `setDescParceladoGlobal2(n)`.

Ajuste pequeno do texto de ajuda logo abaixo, indicando que o desconto se aplica às duas mensagens.

Nada mais muda:
- O editor de templates continua salvando defaults independentes por mensagem.
- A renderização (`mensagemDoCliente` / `copiarMsg`) já lê as variáveis corretas — basta mantê-las sincronizadas.
- Ao recarregar a página, os defaults salvos voltam a popular cada mensagem normalmente; o usuário sobrescreve as duas ao mexer nos campos.

## Resultado

Sempre que você alterar `% Desconto à vista` ou `% Desconto parcelado` na tela, o botão **Mensagem 2** passará a copiar o texto com o desconto atualizado, igual à Mensagem 1.
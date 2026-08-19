# Ícones compactos no cabeçalho da conversa do Inbox Meta Oficial

## O que muda

No cabeçalho de cada conversa ativa do Inbox Meta Oficial, os botões **Qualificação** e **Não precisa resposta** passam a ser botões quadrados apenas com ícones, seguindo o mesmo padrão já aplicado ao botão **Modelo** e ao novo botão **Agendar retorno**.

### Qualificação

- Botão quadrado (`size="icon"`, `h-7 w-7 p-0`), `variant="outline"`.
- Ícone `Tag` do lucide-react.
- Quando a conversa já tem qualificação, o ícone usa a cor da primeira qualificação ativa como `color` (bolinhas coloridas permanecem sobrepostas no canto do ícone, se couber visualmente, ou simplesmente a cor do ícone muda).
- Quando não há qualificação, o ícone usa a cor muted.
- Tooltip/title: "Qualificar esta conversa".
- O dialog de qualificação existente (`MetaQualificacaoDialog`) continua abrindo ao clicar.

### Não precisa resposta

- Botão quadrado (`size="icon"`, `h-7 w-7 p-0`).
- Ícone `CheckSquare` quando marcado, `Square` quando desmarcado.
- `variant="secondary"` quando ativo, `variant="outline"` quando inativo.
- Tooltip: "Não precisa resposta" (ou "Remover dispensa" quando ativo).
- Lógica de dispensar (`handleDispensarResposta`) e critérios de ativo/inativo permanecem inalterados.

### Layout geral

- Os quatro botões (Qualificação, Modelo, Agendar retorno, Não precisa resposta) ficam alinhados lado a lado, com o mesmo tamanho e espaçamento (`gap-1.5`).
- Apenas o selo "Aberta/Fechada em 24h" permanece como badge de texto ao lado dos ícones.

## Detalhes técnicos

- Arquivo: `src/pages/InboxMeta.tsx`.
- Não cria novos componentes, dialogs, tabelas, schemas, crons, realtimes, polling ou edge functions.
- Custo de backend inalterado: zero.
- O ícone `Tag` já está importado no topo do arquivo; `CheckSquare` e `Square` também já estão importados.

## Passos

1. Localizar o bloco do botão de qualificação (linhas ~1965-2008) e reescrevê-lo como botão ícone, mantendo o cálculo da primeira cor ativa.
2. Localizar o bloco do checkbox "Não precisa resposta" (linhas ~2031-2046) e reescrevê-lo como botão ícone com `CheckSquare`/`Square` e variant alternada.
3. Verificar se os quatro botões estão visualmente alinhados.
4. Executar build/typecheck para validar.

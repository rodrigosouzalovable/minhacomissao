# Ajustar a janela "Contatos acionados recentemente"

## Problema
Na confirmação antes do disparo, a caixa com "Enviar para todos" / "Ignorar os recentes" estoura para a direita e os números de cada opção ficam escondidos. Os quatro botões do rodapé também não cabem na largura da janela, que é estreita.

## Correção
- Deixar a janela um pouco mais larga, sem passar da tela.
- Caixa de resumo com largura total da janela: texto à esquerda e quantidade à direita, sempre visíveis dentro da borda.
- Rodapé com os botões organizados em duas linhas quando não houver espaço: "Baixar números" e "Cancelar" de um lado, "Ignorar recentes" e "Enviar para todos" do outro, sem sair da janela.
- Nada muda no comportamento dos botões nem no envio.

## Detalhes técnicos
- `src/pages/EnvioMeta.tsx`, diálogo `reenvioDlg`: `AlertDialogContent` de `max-w-lg` para `w-[calc(100vw-2rem)] max-w-2xl overflow-hidden`; linhas do resumo em `grid grid-cols-[1fr_auto]`; `AlertDialogFooter` com `flex-wrap gap-2` e grupos com `flex-wrap`.
- Conferir no navegador na largura atual (1121px).

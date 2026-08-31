# Duas barras de rolagem no diálogo da campanha

Hoje o diálogo de detalhes da campanha tem altura fixa (85% da tela) e só a lista "Enviados/Erros" rola; o painel "Instâncias do disparo" tem sua própria área rolável de 320px. Quando o painel de instâncias abre, o topo (progresso, avisos, botões) fica comprimido e parte do conteúdo pode não ser alcançada.

## O que muda

1. **Barra de rolagem da tela inteira da campanha** — todo o corpo do diálogo (progresso, avisos, painel de instâncias, resumo de entrega, ações e listas) passa a rolar verticalmente como um bloco único, com barra discreta à direita. Cabeçalho (nome da campanha, template, data) continua fixo no topo.
2. **Barra de rolagem do painel de instâncias** — mantida como está: área própria de 320px com barra fina para as listas "Ativas" e "Ignoradas".

Resultado: duas barras visíveis — a externa do diálogo e a interna do painel de instâncias.

## Detalhes técnicos

Arquivo: `src/components/meta/CampanhaDetalheDialog.tsx`

- Container do corpo (linha ~408): trocar `overflow-hidden` por `overflow-y-auto` e remover `flex-1 min-h-0` do bloco de listas para que ele cresça naturalmente dentro do scroll externo.
- Bloco "Enviados/Erros" (linha ~692): remover `flex-1 min-h-0 overflow-y-auto`, mantendo apenas espaçamento — o scroll passa a ser do corpo.
- Aplicar a classe utilitária existente `scrollbar-thin` (já definida em `src/index.css`) ao corpo do diálogo para a barra ficar discreta.
- `CampanhaInstanciasPanel.tsx` permanece inalterado (já usa `ScrollArea` de 320px).

Sem mudanças em banco, Edge Functions ou custo.

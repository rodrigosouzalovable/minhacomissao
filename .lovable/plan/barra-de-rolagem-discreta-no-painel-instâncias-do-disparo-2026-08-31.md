Barra de rolagem discreta no painel "Instâncias do disparo"

O painel de instâncias da campanha (`CampanhaInstanciasPanel`) expande verticalmente conforme a quantidade de instâncias, o que pode empurrar o conteúdo para fora da viewport do diálogo. Será adicionada uma barra de rolagem fina e discreta do lado direito, usando o componente `ScrollArea` já existente do projeto.

Alterações previstas
1. `src/components/meta/CampanhaInstanciasPanel.tsx`
   - Importar `ScrollArea` de `@/components/ui/scroll-area`.
   - Envolver a lista de instâncias (seções "Ativas" e "Ignoradas") em `<ScrollArea className="h-[320px] pr-1">`.
   - Manter o cabeçalho do painel (botão "Instâncias do disparo" e contadores) fixo fora da área rolável.
   - Preservar o botão "Atualizar" e o estado de carregamento.

2. Teste visual
   - Abrir o diálogo de detalhes de uma campanha com várias instâncias.
   - Verificar se a lista de instâncias rola para cima e para baixo com a barra fina do shadcn/ui.
   - Confirmar que a barra aparece apenas quando o conteúdo excede a altura máxima.

Sem impacto em banco de dados, Edge Functions ou custo adicional.

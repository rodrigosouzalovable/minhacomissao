Corrigir rolagem do diálogo "Integração 3C Plus"

O diálogo de configuração da 3C Plus já usa `ScrollArea`, mas não está rolando corretamente porque o contêiner flex do `DialogContent` não restringe a altura do scroll o suficiente em telas menores. A correção é forçar uma altura máxima explícita no `ScrollArea` e manter a barra de rolagem sutil do shadcn/ui.

Alterações previstas
1. `src/components/relatorios/Config3CPlusDialog.tsx`
   - Substituir `className="flex-1 pr-3"` do `ScrollArea` por uma altura máxima fixa e responsiva (ex.: `h-[calc(80vh-10rem)] max-h-[620px] pr-3`), garantindo que o conteúdo seja rolável mesmo quando o flex não calcule a altura corretamente.
   - Manter o `ScrollArea` e `ScrollBar` do shadcn/ui (já são finos e discretos).
   - Verificar se o `DialogContent` continua com `max-h-[85vh] flex flex-col` e ajustar o `DialogHeader`/`DialogFooter` para não empurrar o conteúdo para fora da viewport.

2. Teste visual
   - Abrir o diálogo em preview e verificar se é possível rolar até a seção "Qualificações → CPC / CPC-A" com muitos itens.
   - Confirmar que a barra de rolagem permanece fina e não quebra o layout do rodapé com os botões "Fechar" e "Sincronizar ligações de hoje".

Sem impacto em banco de dados, Edge Functions ou custo adicional.

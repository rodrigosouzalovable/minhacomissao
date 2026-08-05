# Corrigir rolagem do diálogo "Configurar IA da caixa"

O diálogo de configuração da IA da caixa "IA" já usa `ScrollArea`, mas o conteúdo não está rolando corretamente porque o contêiner flex do `DialogContent` não restringe a altura do scroll em telas menores. O usuário precisa de uma barra de rolagem para visualizar o conteúdo completo e alcançar o botão de salvar.

## Alterações previstas

1. `src/components/inbox/meta/MetaIAConfigDialog.tsx`
   - Adicionar `overflow-hidden` no `DialogContent` para garantir que o flex filho respeite a altura máxima (`max-h-[85vh]`).
   - Substituir `className="flex-1 min-h-0 pr-3"` do `ScrollArea` por uma altura máxima fixa e responsiva (ex.: `h-[calc(80vh-10rem)] max-h-[620px] pr-3`), garantindo que o conteúdo seja rolável mesmo quando o flex não calcule a altura corretamente.
   - Manter o `ScrollArea` e `ScrollBar` do shadcn/ui (já são finos e discretos).
   - Verificar se o `TabsList` permanece fixo no topo e se cada aba mantém seu botão de salvar acessível ao final da rolagem.

2. Teste visual
   - Abrir o diálogo no preview e verificar se é possível rolar para cima e para baixo dentro de cada aba (Proposta, Modelos, Emergência).
   - Confirmar que o botão "Salvar" aparece ao final da rolagem e a barra de rolagem permanece fina.

Sem impacto em banco de dados, Edge Functions ou custo adicional.

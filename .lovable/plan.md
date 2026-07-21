## Objetivo
Reorganizar o dialog "Etiquetas Meta" (acessado via clique direito → Etiquetas → Gerenciar etiquetas) para que todos os elementos caibam de forma limpa dentro do espaço, sem sobreposição do botão "Criar etiqueta" com a lista.

## Alterações em `src/components/inbox/meta/MetaEtiquetasDialog.tsx`

1. **Aumentar largura e estruturar em seções claras**
   - Trocar `max-w-sm` por `max-w-md` para dar mais respiro horizontal.
   - Dividir o conteúdo em duas seções visuais com separador (`<Separator />`):
     - **Seção "Nova etiqueta"**: input de nome, paleta de cores e botão "Criar etiqueta".
     - **Seção "Etiquetas existentes"**: título pequeno + contador (ex: "6 etiquetas") + lista rolável.

2. **Corrigir a sobreposição visual**
   - Envolver a lista em um container com fundo próprio (`rounded-md border bg-muted/30 p-2`) e `max-h-64 overflow-y-auto` para o scroll ficar contido dentro da seção.
   - Adicionar `pr-1` no scroll para a scrollbar não colar nos ícones de ação.

3. **Ajustes finos de layout**
   - Alinhar as bolinhas de cor em grid fixo (`grid grid-cols-8 gap-2`) em vez de flex-wrap, evitando quebra irregular.
   - Padronizar altura dos itens da lista (`h-10`) e usar `text-sm font-medium` no nome.
   - Ícones de editar/excluir agrupados com um leve divisor visual (`border-l pl-1 ml-1`).
   - Adicionar rótulo "Cor" acima da paleta no formulário de criação e no modo edição.

4. **Estado vazio**
   - Quando não houver etiquetas, mostrar mensagem discreta "Nenhuma etiqueta criada ainda." dentro do container da lista, em vez de esconder a seção.

Nenhuma alteração de lógica/negócio — apenas apresentação.
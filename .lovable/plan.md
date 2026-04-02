

## Reorganizar abas da sidebar com drag-and-drop

### O que será feito
Permitir que cada usuário arraste os itens do menu lateral para reorganizá-los na ordem que preferir. A ordem será salva no banco de dados (tabela `profiles`) e carregada automaticamente ao logar.

### Como funciona

1. **Biblioteca de drag-and-drop**: Instalar `@dnd-kit/core` e `@dnd-kit/sortable` — leve, acessível e ideal para listas reordenáveis.

2. **Nova coluna no banco**: Adicionar `sidebar_order jsonb default null` na tabela `profiles`. Armazena um array de hrefs na ordem personalizada, ex: `["/dashboard", "/acordos", "/conta", ...]`. Se `null`, usa a ordem padrão.

3. **Alteração no `AppLayout.tsx`**:
   - Carregar a ordem salva do perfil do usuário
   - Envolver os itens de navegação com `DndContext` + `SortableContext` do dnd-kit
   - Cada item de nav vira um `SortableItem` com handle de arraste (ícone de grip)
   - Ao soltar, reordenar o array localmente e salvar no banco (`profiles.sidebar_order`)
   - Ícone de grip aparece ao passar o mouse sobre o item

4. **Arquivos alterados**:
   - `src/components/layout/AppLayout.tsx` — lógica de drag-and-drop e reordenação
   - Nova migração SQL — adicionar coluna `sidebar_order` em `profiles`
   - `package.json` — adicionar `@dnd-kit/core` e `@dnd-kit/sortable`

### Detalhes técnicos

- A coluna `sidebar_order` armazena apenas os `href` dos itens na ordem desejada. Itens novos que não estão no array salvo são adicionados ao final.
- O filtro de permissões (admin/gestor/abasPermitidas) continua sendo aplicado **antes** da reordenação — o drag-and-drop só reordena itens que o usuário tem acesso.
- O salvamento é feito com debounce para evitar muitas chamadas ao banco durante arraste rápido.


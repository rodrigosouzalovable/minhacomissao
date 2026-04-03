

## 5 Modificações nas Configurações WhatsApp (Acionamento)

### Resumo
1. Remover bloco Z-API (linhas 1699-1706)
2. Novos números aparecem no topo da lista
3. Drag-and-drop para reordenar instâncias
4. Webhook do Chatbot IA visível apenas para rodrigo.rs2013@gmail.com
5. Remover seção "Testar envio" do dialog de configurações

### Alterações

**Migração de banco de dados:**
- Adicionar coluna `ordem integer default 0` à tabela `user_whatsapp_instances`

**Arquivo: `src/pages/Acionamento.tsx`**

1. **Remover bloco Z-API** (linhas 1699-1706): Deletar o bloco `{isAdmin && (...)}` com a mensagem sobre Z-API fallback e o badge "Z-API (Padrão do sistema)"

2. **Novos números no topo** (linha 823): Trocar `[...prev, data as any]` por `[data as any, ...prev]`

3. **Drag-and-drop nas instâncias**:
   - Importar `DndContext`, `SortableContext`, `closestCenter`, `verticalListSortingStrategy`, `arrayMove`, `useSortable`, `CSS` (mesmas libs já usadas na sidebar)
   - Criar um componente inline `SortableInstanceCard` que usa `useSortable` e renderiza cada card de instância com ícone `GripVertical` à esquerda
   - Envolver a lista de instâncias (linha 1886) com `DndContext` + `SortableContext`
   - No `handleDragEnd`, reordenar array local e persistir via updates no campo `ordem`
   - Alterar fetch (linha 263) para ordenar por `ordem ASC, criado_em DESC`

4. **Webhook visível só para rodrigo.rs2013@gmail.com** (linha 2013): Trocar `{isAdmin && (` por `{user?.email === 'rodrigo.rs2013@gmail.com' && (`

5. **Remover "Testar envio"** (linhas 2056-2073): Deletar o `<Separator />` e o bloco inteiro de "Testar envio" dentro do dialog de configurações (manter o "Testar envio" da área principal de acionamento, se existir)

### Detalhes técnicos

- O `@dnd-kit/sortable` já está instalado no projeto (usado em `SortableNavItem.tsx`)
- O `SortableInstanceCard` seguirá o mesmo padrão do `SortableNavItem`: `useSortable` → `transform`/`transition` → `GripVertical` no hover
- A persistência de ordem faz um loop de updates: `UPDATE user_whatsapp_instances SET ordem = index WHERE id = ...`
- Variáveis `testPhone` e `sendingTest` permanecem no componente pois são usadas no "Testar envio" da área principal (linha 1337)


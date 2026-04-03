

## Badge de conversas não lidas no menu lateral "WhatsApp Inbox"

### Resumo
Adicionar um círculo vermelho com o número total de conversas não lidas ao lado do label "WhatsApp Inbox" na sidebar, igual ao estilo do sino de notificações.

### Alterações

**Arquivo: `src/components/layout/SortableNavItem.tsx`**

1. Adicionar prop opcional `badge?: number` à interface `SortableNavItemProps`
2. Quando `badge > 0`, renderizar um `<span>` circular vermelho com o número ao lado direito do label, com estilo similar ao badge do sino (fundo vermelho, texto branco, tamanho pequeno)

**Arquivo: `src/components/layout/AppLayout.tsx`**

1. Criar um estado `inboxUnreadCount` e um `useEffect` que consulta a tabela `whatsapp_contatos` filtrando por `nao_lido > 0` e pelas instâncias do usuário, contando o total de conversas com mensagens não lidas
2. Adicionar um subscription realtime na tabela `whatsapp_contatos` para manter o contador atualizado em tempo real
3. Passar a prop `badge={inboxUnreadCount}` ao `SortableNavItem` cujo `href === '/inbox'`

### Detalhes técnicos

- Query: `supabase.from('whatsapp_contatos').select('id', { count: 'exact' }).gt('nao_lido', 0)` filtrado pelas instâncias vinculadas ao usuário (via `user_whatsapp_instances`)
- Realtime: subscribe a changes na tabela `whatsapp_contatos` para re-fetch quando houver updates
- Badge visual: `bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center` posicionado com `ml-auto`


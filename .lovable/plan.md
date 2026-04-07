

## Plano: Filtrar conversas do Inbox por instâncias do usuário

### Problema
A query de **contatos** (`whatsapp_contatos`) não filtra por instância do usuário. Embora o dropdown de instâncias já mostre apenas as do usuário logado, a lista de conversas carrega contatos de **todas** as instâncias, incluindo as de outros usuários.

### Solução

**Arquivo: `src/pages/WhatsAppInbox.tsx`**

1. **Filtrar contatos pelas instâncias do usuário**: No `fetchContatos`, quando o usuário não é admin e não tem `inboxCompartilhado`, adicionar `.in('instancia_id', instancias.map(i => i.id))` para limitar os contatos apenas às instâncias carregadas para aquele usuário.

2. **Adicionar dependências corretas**: Incluir `instancias`, `isAdmin` e `inboxCompartilhado` nas dependências do `useCallback` de `fetchContatos`.

3. **Aguardar instâncias carregarem**: Só executar `fetchContatos` quando as instâncias já tiverem sido carregadas, evitando uma query sem filtro no primeiro render.

### Detalhes técnicos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/WhatsAppInbox.tsx` | Adicionar filtro `.in('instancia_id', ...)` em `fetchContatos` quando não admin/compartilhado |

A mesma lógica já existe em `fetchInstancias` (linhas 115-117) — vamos replicar o padrão para os contatos.


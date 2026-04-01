

## Priorizar conversas não lidas no topo

### Alteração

**Arquivo**: `src/pages/WhatsAppInbox.tsx`

Na lista de contatos filtrados, antes de renderizar, ordenar para que conversas com `nao_lido > 0` apareçam primeiro, mantendo a ordenação por `ultima_mensagem_em` dentro de cada grupo (não lidas e lidas).

Alterar a lógica de `contatosFiltrados` para aplicar um sort após o filter:

```typescript
const contatosFiltrados = contatos
  .filter(c => {
    if (!busca) return true;
    const term = busca.toLowerCase();
    return (c.nome?.toLowerCase().includes(term) || c.telefone.includes(term));
  })
  .sort((a, b) => {
    // Unread first
    if (a.nao_lido > 0 && b.nao_lido === 0) return -1;
    if (a.nao_lido === 0 && b.nao_lido > 0) return 1;
    // Then by most recent message
    return new Date(b.ultima_mensagem_em || 0).getTime() - new Date(a.ultima_mensagem_em || 0).getTime();
  });
```

Uma única alteração em um único arquivo.


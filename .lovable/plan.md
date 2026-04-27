# Estabilizar banco e reimplementar "Arquivados" sem trigger

## Contexto

O sistema voltou após upgrade da instância para SMALL. A causa raiz do travamento foi o trigger `trg_auto_arquivar_contato_interno` na tabela `whatsapp_contatos`, que executava lookups cruzados em `user_whatsapp_instances` a cada INSERT/UPDATE de contato — saturando o pool de conexões sob volume de webhooks.

A função SQL `auto_arquivar_contato_interno()` ainda existe no banco (vista em `<db-functions>`), mas o trigger pode já ter sido removido. Precisamos garantir limpeza total e implementar a feature "Arquivados" sem qualquer overhead no banco.

## Etapa 1 — Limpeza do banco (migração)

Migração SQL idempotente:

```sql
DROP TRIGGER IF EXISTS trg_auto_arquivar_contato_interno ON public.whatsapp_contatos;
DROP FUNCTION IF EXISTS public.auto_arquivar_contato_interno() CASCADE;
```

Isso elimina definitivamente o gargalo. A coluna `arquivado` em `whatsapp_contatos` permanece intacta (continuará sendo usada, agora atualizada manualmente).

## Etapa 2 — Reimplementar "Arquivados" no frontend (zero custo de DB)

A detecção de "conversa interna" (entre minhas próprias instâncias WhatsApp) será feita **no client**, comparando o sufixo (últimos 8 dígitos) do telefone do contato com a lista de telefones das instâncias ativas do usuário — padrão já estabelecido em `mem://technical/whatsapp/phone-suffix-matching-standard`.

**Mudanças em `src/pages/WhatsAppInbox.tsx`:**

1. Carregar uma única vez a lista de sufixos das instâncias do usuário:
   ```ts
   const { data: instancias } = await supabase
     .from('user_whatsapp_instances')
     .select('telefone')
     .eq('user_id', user.id)
     .eq('ativo', true);
   const sufixosInternos = new Set(
     instancias.map(i => (i.telefone || '').replace(/\D/g, '').slice(-8)).filter(s => s.length === 8)
   );
   ```

2. Função pura `isContatoInterno(telefone)` que retorna `true` se o sufixo bate com algum sufixo interno.

3. Filtrar a lista lateral de conversas:
   - Aba **"Conversas"** (lateral principal): exclui contatos onde `isContatoInterno(telefone) === true` OU `arquivado === true`.
   - Aba **"Arquivados"** (já criada anteriormente): mostra contatos `isContatoInterno(telefone) === true` OU `arquivado === true`.

4. Manter o item de menu de contexto "Arquivar/Desarquivar" em `ConversaContextMenu.tsx` para arquivamento manual (atualiza coluna `arquivado` diretamente via UPDATE — operação pontual, sem trigger).

## Etapa 3 — Validação

- Confirmar que a aba "Arquivados" lista corretamente as conversas entre instâncias próprias.
- Confirmar que a lateral principal só mostra conversas de clientes externos.
- Confirmar que arquivamento/desarquivamento manual funciona sem disparar trigger.
- Verificar logs para garantir que o pool de conexões ficou estável.

## Arquivos a modificar

- **Migração nova** (DROP trigger + função)
- `src/pages/WhatsAppInbox.tsx` (lógica de filtro lateral)

## O que NÃO será feito

- Nenhum trigger novo no banco.
- Nenhuma Edge Function nova (sem custo extra de Cloud).
- Nenhuma alteração na webhook `whatsapp-qr` (já foi limpa anteriormente).
- Não restaurar a função `auto_arquivar_contato_interno` em hipótese alguma.

## Custo

Zero impacto adicional em Lovable Cloud — a feature passa a rodar 100% no client com dados já carregados.

Aprovar para eu rodar a migração e ajustar o Inbox.
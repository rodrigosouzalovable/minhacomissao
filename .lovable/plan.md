## Problema

Em `src/pages/InboxMeta.tsx` (linha 143-144), o carregamento das etiquetas filtra por `user_id = user.id`:

```ts
.from('meta_whatsapp_etiquetas').select(...).eq('user_id', user.id)
```

Isso faz com que apenas o admin (que criou as etiquetas "Atendente: Yasmim", "Atendente: Wallace", etc.) veja os chips coloridos. Os atendentes com `inbox_compartilhado = true` já têm permissão de SELECT via RLS (`meta_etiquetas_shared_select`), mas o filtro no front-end esconde as etiquetas do dono.

## Correção

1. Em `fetchEtiquetas` (InboxMeta.tsx), remover o `.eq('user_id', user.id)` — a RLS já garante o acesso correto:
   - Admin/dono continua vendo suas próprias etiquetas.
   - Atendentes compartilhados passam a ver todas as etiquetas do inbox compartilhado (incluindo "Atendente: X").

Nenhuma alteração em banco/RLS é necessária — as policies já suportam o acesso compartilhado. `fetchContatoEtiquetas` já não filtra e também funcionará normalmente.

## Verificação

Logar como Anna Flavia / Yasmim / Fernanda / Wallace e conferir que os chips "Atendente: ..." agora aparecem ao lado dos nomes na lista de conversas do Inbox Meta Oficial.
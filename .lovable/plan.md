## Problema

O drag-and-drop de arquivos no Inbox Meta faz upload no bucket `inbox-media` usando o caminho `meta/{instancia_id}/{telefone}/{timestamp}.{ext}`. As policies de storage (migration `20260720102109`) tentam validar a propriedade fazendo cast do **primeiro segmento da pasta** para `uuid` (`(storage.foldername(name))[1]::uuid`). Como o primeiro segmento é a string literal `"meta"`, o Postgres retorna:

```
invalid input syntax for type uuid: "meta"
```

## Correção

Em `src/pages/InboxMeta.tsx` (função `enviarMidia`, linha 591), remover o prefixo `meta/` para que o caminho fique no formato aceito pelas policies:

```
{instancia_id}/{telefone}/{timestamp}.{ext}
```

Isso alinha o Inbox Meta ao mesmo padrão já usado pelo `ChatInputBar` do inbox clássico (que funciona corretamente) e satisfaz a checagem `EXISTS (... WHERE i.id::text = foldername[1] AND i.user_id = auth.uid())`.

Nenhuma alteração de banco, edge function ou policy é necessária — apenas o caminho no cliente.

## Detalhes técnicos

- Arquivo alterado: `src/pages/InboxMeta.tsx` (apenas a linha do `path`).
- Sem impacto em uploads anteriores (já enviados via outros fluxos).
- Sem impacto em edge functions — `send-whatsapp-meta-media` recebe apenas a URL pública final.

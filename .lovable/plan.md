## Problema

O seletor "Validar WhatsApp antes do disparo" está vazio porque a query filtra por `status = 'connected'`, mas a tabela `user_whatsapp_instances` **não tem coluna `status`** (a conexão UAZAPI é verificada em runtime, não armazenada). Como o cliente Supabase está com cast `as any`, o erro é silencioso e o array fica vazio.

## Correção

Em `src/pages/EnvioMeta.tsx`, na função `carregar()`:

- Remover o filtro `.eq("status", "connected")` da query de `user_whatsapp_instances`.
- Remover `status` do `select(...)`.
- Manter o filtro `ativo = true`.

Resultado: o seletor passa a listar todas as instâncias UAZAPI ativas do usuário (que é como funciona em outras telas do projeto, ex. Inbox/Envios). A verificação real de conectividade já acontece dentro da edge function `check-whatsapp-numbers` no momento da validação — se a instância escolhida estiver offline, o erro é exibido via toast.

Nenhuma alteração de schema, edge function ou backend.
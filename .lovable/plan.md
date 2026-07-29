## Correção: Criação de Caixas de Mensagens no Inbox Meta

### Problema
As tabelas `meta_inbox_folders` e `meta_inbox_folder_members` estão sem GRANTs para o role `authenticated`, o que faz o PostgREST bloquear qualquer INSERT/UPDATE/DELETE silenciosamente — inclusive para admins. Por isso o botão "Criar" não faz nada.

### Passos

1. **Migration SQL** — restaurar privilégios de dados nas duas tabelas, mantendo RLS:
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folders TO authenticated`
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_members TO authenticated`
   - `GRANT ALL ... TO service_role` em ambas
   - RLS permanece como está (criação/edição apenas por admin ou dono conforme policies existentes)

2. **Melhoria de UX em `MetaFoldersDialog.tsx`**
   - Exibir mensagem de erro clara via toast quando o insert falhar (hoje falha silenciosa)
   - Logar `error.message` retornado pelo Supabase para facilitar diagnóstico futuro

### Verificação
- Após migration, testar criação de uma caixa nova como admin no Inbox Meta
- Confirmar que a caixa aparece na lista e pode ser selecionada em Envio Meta

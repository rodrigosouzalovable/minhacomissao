# Lista completa de usuários ativos no acesso às caixas de mensagens

## Problema confirmado

O diálogo "Atendentes da caixa X" mostra hoje apenas 7 nomes porque ele usa a função `listar_funcionarios`, que retorna somente usuários que **já lançaram algum acordo** (ela lê a tabela de acordos). Existem 15 usuários ativos cadastrados no sistema — os outros 8 nunca aparecem para seleção.

## O que será feito

1. Nova função no banco `listar_usuarios_ativos()` (security definer) retornando `user_id` e `nome` de todos os perfis com `ativo = true`, ordenados por nome.
   - Acesso restrito a usuários autenticados; usada apenas para montar a lista de seleção.
2. `MetaFolderAcessoDialog.tsx` passa a chamar `listar_usuarios_ativos` em vez de `listar_funcionarios`, mantendo busca, "Marcar todos" / "Desmarcar todos" e o contador no título.
3. Nada muda na regra de visibilidade já existente: quem for marcado numa caixa vê aquela caixa; quem não estiver marcado não vê. Admin continua vendo todas.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.listar_usuarios_ativos() RETURNS TABLE(user_id uuid, nome text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public` selecionando de `public.profiles` onde `ativo`, com `COALESCE(nome, email)`; `REVOKE ... FROM anon` / `GRANT EXECUTE ... TO authenticated`.
- Frontend: apenas troca do nome da RPC em `src/components/inbox/meta/MetaFolderAcessoDialog.tsx` (usado tanto pelo menu de contexto nas abas do Inbox quanto pelo `MetaFoldersDialog`).
- Sem alteração em policies de `meta_inbox_folder_members`, `meta_inbox_default_members` ou nas policies restritivas de `meta_whatsapp_contatos` / `meta_whatsapp_mensagens`.

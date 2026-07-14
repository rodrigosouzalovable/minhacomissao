## Objetivo
Adicionar, no popover do sino de "Consultas de CPF" (Inbox Meta), um botão para baixar em Excel todos os CPFs que já consultaram no portal.

## Mudanças

**Arquivo:** `src/components/inbox/meta/NotificacoesCpfBell.tsx` (somente UI)

1. Novo botão **"Baixar Excel"** (ícone `Download`) no cabeçalho do popover, ao lado de "Marcar todas".
2. Ao clicar:
   - Busca em `consulta_cpf_notificacoes` todas as linhas (sem limite de 50), respeitando o mesmo filtro atual:
     - Admin: todas
     - Não-admin: apenas `assigned_user_id = user.id`
   - Ordena por `created_at desc`.
   - Se admin, resolve nomes via `profiles` (como já é feito) para exibir "Atribuído a".
   - Usa `exportarParaExcel` (`src/lib/exportExcel.ts`) para gerar o arquivo.
3. Colunas exportadas:
   - Data/Hora (BRT formatado)
   - CPF (formatado 000.000.000-00)
   - Nome
   - Credor
   - Total de débitos
   - Telefone(s)
   - Atribuído a (nome do usuário — só preenchido para admin; para não-admin fica vazio ou o próprio nome)
   - Lida em (BRT ou vazio)
   - CPF copiado em (BRT ou vazio)
4. Nome do arquivo: `consultas-cpf-portal-YYYY-MM-DD`.
5. Toast de sucesso/erro.

## Fora do escopo
- Sem alterações em backend, edge functions, RLS ou tabelas.
- Sem mudanças na lógica de rodízio/notificações.

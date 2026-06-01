## Objetivo

Apenas o admin pode lançar acordo com CPF que já tem outro acordo. Funcionários (mesmo os que hoje têm a permissão `permite_cpf_duplicado`) ficam bloqueados, exceto quando o último acordo do CPF está "quebrado".

## Mudanças

### 1. Banco — trigger `acordos_block_duplicate_cpf`

Reescrever a função para remover a exceção da permissão individual:

- Mantém bypass apenas para admin (`is_admin_user(auth.uid())`).
- Remove o bloco que consulta `user_permissions.permite_cpf_duplicado`.
- Mantém a exceção quando `cpf_ultimo_acordo_quebrado` é verdadeiro.
- Atualiza a mensagem de erro para o formato pedido:
  `"Este CPF já possui acordo lançado por {Nome} em {dd/mm/aaaa}. Apenas o administrador pode lançar acordos duplicados."`
  (busca também a `criado_em` do último acordo do CPF para compor a data.)

### 2. Frontend — telas de criação de acordo

`src/pages/NovoAcordo.tsx` (e qualquer fluxo de criação de funcionário) hoje usa o hook de validação em tempo real de CPF. Ajustes:

- Quando a verificação detectar acordo existente para o CPF e o usuário não for admin, exibir mensagem no mesmo formato e desabilitar o botão "Salvar".
- A exceção "último acordo quebrado" continua liberando o salvamento normalmente.
- A flag `permiteCpfDuplicado` exposta em `useUserPermissions` deixa de afetar o bloqueio — ela passa a ser ignorada no formulário (campo continua na tabela por compatibilidade, mas sem efeito).
- `NovoAcordoAdmin.tsx` continua livre (admin).

### 3. Tela de permissões

`src/components/EditPermissionsDialog.tsx`: ocultar/remover o switch "Permite CPF duplicado", já que a permissão deixou de ter efeito. (Coluna permanece no banco para não quebrar migrações antigas; só some da UI.)

## Detalhes técnicos

- Migration única alterando `public.acordos_block_duplicate_cpf()`. Não mexe em RLS, tabelas, ou outros triggers.
- Mensagem da exception usa `to_char(a.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')`.
- Frontend: o erro do Postgres já sobe via `supabase.from('acordos').insert(...)`; basta exibir `error.message` no toast, além do bloqueio preventivo no formulário.

## Fora de escopo

- Não altera regras de quebra de acordo (10 dias) nem fluxo do admin.
- Não toca em `acordos_devedor` (CPFs do portal público), só em `acordos`.
- Não mexe em RLS nem em outros gatilhos.

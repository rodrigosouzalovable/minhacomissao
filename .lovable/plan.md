## Objetivo
Permitir que o admin, ao lançar um novo acordo pela tela padrão `/acordos/novo`, escolha o operador (funcionário) ao qual o acordo ficará vinculado.

## Mudança proposta

Arquivo: `src/pages/NovoAcordo.tsx`

1. Detectar admin via `useUserRole()` (já usado em outras páginas).
2. Quando `isAdmin === true`, carregar a lista de operadores ativos da tabela `profiles` (id, nome, email) ordenada por nome — query simples com `useQuery`.
3. Adicionar no topo do formulário (logo após o cabeçalho/voltar, antes de "Dados do Cliente") um novo card "Operador responsável" contendo um `Select` (shadcn) com:
   - Opção padrão: o próprio admin logado ("Eu — {nome}")
   - Demais operadores listados
   - Campo obrigatório
4. Manter o estado `selectedUserId` (default = `user.id`).
5. No `handleSubmit`, ao inserir em `acordos`, usar `user_id: isAdmin ? selectedUserId : user.id` em vez de sempre `user.id`. O restante (parcelas, instância de WhatsApp, comissão) permanece igual.
6. Toast de sucesso passa a mencionar o nome do operador escolhido quando diferente do admin.
7. Para funcionários comuns nada muda — o card do seletor só renderiza se `isAdmin`.

## Pontos que NÃO mudam
- Rota, permissões, RLS e cálculos de comissão permanecem iguais (admins já podem inserir acordos para qualquer `user_id` via policies existentes — mesmo padrão já usado em `NovoAcordoAdmin.tsx`).
- Página `/admin/usuarios/:userId/novo-acordo` (NovoAcordoAdmin) continua existindo e funcionando normalmente.
- Nenhuma migração de banco necessária.

## Detalhes técnicos
- Lista de operadores: `supabase.from('profiles').select('id, nome, email').order('nome')`.
- Componente: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` de `@/components/ui/select`.
- Carregamento da lista de instâncias de WhatsApp (se houver no NovoAcordo, igual ao Admin) deve reagir ao `selectedUserId` para mostrar as instâncias do operador escolhido.
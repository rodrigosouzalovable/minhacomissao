## Bloqueio total de CPF duplicado (somente admin)

Hoje o trigger `acordos_block_duplicate_cpf` já bloqueia CPFs repetidos, mas tem duas exceções que permitem funcionários lançarem mesmo assim:

1. Permissão individual `user_permissions.permite_cpf_duplicado = true`
2. Regra "último acordo quebrado" (`cpf_ultimo_acordo_quebrado`) — se o último acordo do CPF está quebrado/vencido há +10 dias, qualquer funcionário pode lançar de novo

O pedido é: **se já existe QUALQUER acordo com aquele CPF no sistema, só o admin pode lançar**. Sem exceções.

### Mudança

Migration ajustando `public.acordos_block_duplicate_cpf()`:

- Mantém: se `is_admin_user(auth.uid())` → libera.
- Remove: o `IF COALESCE(v_perm, false)` que libera por `permite_cpf_duplicado`.
- Remove: o `IF cpf_ultimo_acordo_quebrado(...)` que libera quando o último acordo estava quebrado.
- Mantém a checagem `EXISTS (SELECT 1 FROM acordos WHERE cpf_normalize(cliente_cpf) = ...)` — se existe qualquer acordo com o mesmo CPF (independente de status: ativo, concluído, quebrado, cancelado), bloqueia com a mesma mensagem atual informando quem lançou e quando.

Nome e status do acordo anterior continuam aparecendo na mensagem de erro para o funcionário saber para quem pedir liberação.

### Impactos colaterais

- A flag `permite_cpf_duplicado` em `user_permissions` deixa de ter efeito prático. Não vou remover a coluna nem a UI que a controla neste passo (pode ser útil reativar no futuro); ela simplesmente será ignorada pelo trigger. Me avise se prefere que eu remova também.
- A validação em tempo real de CPF no frontend (memo "CPF Validation") continua funcionando como está — ela só avisa; o bloqueio real é no trigger, que fica mais restrito.
- Admin continua com liberdade total via `is_admin_user`.

### Detalhes técnicos

Arquivo alterado: apenas a função `public.acordos_block_duplicate_cpf()` via `supabase--migration` (CREATE OR REPLACE FUNCTION). Nenhum código frontend precisa mudar.
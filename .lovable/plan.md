## Objetivo

Liberar para **Anna Flavia Leite de Morais** duas permissões individuais:
1. **Excluir acordos** (com regras de proteção a parcelas pagas).
2. **Lançar acordo com CPF duplicado** (já tem a flag `permite_cpf_duplicado=true`, mas o trigger do banco e o formulário ainda bloqueiam — precisa ajustar para apenas alertar).

---

## 1. Permissão de excluir acordos (parcial e segura)

### Regras de negócio
- Acordo **sem nenhuma parcela paga** → pode excluir o acordo inteiro (igual admin faz hoje).
- Acordo **com pelo menos uma parcela paga** → não pode excluir o acordo. Mas pode excluir **individualmente** as parcelas ainda pendentes (não pagas).
- Parcela com `status = 'pago'` → **nunca** pode ser excluída.

### Banco de dados
- Adicionar coluna `pode_excluir_acordos boolean default false` em `user_permissions`.
- Marcar `true` para Anna (`bb6a930c-c5e7-45c1-ab27-3cc4e63539f5`).
- Atualizar a função `delete_acordo_atomico(p_acordo_id)` para:
  - Permitir execução se usuário for admin **OU** dono do acordo com `pode_excluir_acordos = true`.
  - Bloquear (RAISE EXCEPTION) se existir qualquer `pagamentos.status = 'pago'` no acordo.
- Criar nova função `excluir_parcela_pendente(p_pagamento_id)` SECURITY DEFINER:
  - Permite admin ou dono com `pode_excluir_acordos=true`.
  - Bloqueia exclusão se a parcela estiver paga.

### Frontend
- **`src/hooks/useUserPermissions.tsx`**: expor `podeExcluirAcordos`.
- **`src/components/EditPermissionsDialog.tsx`**: adicionar switch "Pode excluir acordos" (com aviso de que parcelas pagas ficam protegidas).
- **`src/pages/AcordoDetalhe.tsx`**:
  - Mostrar botão "Excluir Acordo" também quando `podeExcluirAcordos && isOwner`.
  - Se o acordo tiver alguma parcela paga, **esconder/desabilitar** o botão "Excluir Acordo" e mostrar tooltip explicativo.
  - Trocar `handleExcluirAcordo` para chamar `delete_acordo_atomico` (em vez de deletes diretos), capturando erro do banco e exibindo toast claro.
  - No card de cada parcela pendente, exibir um botão "Excluir parcela" (ícone lixeira) para usuários com permissão. Já existe `excluirParcela` — apenas trocar a chamada por `excluir_parcela_pendente` e liberar o gatilho da UI.
- **`src/pages/Acordos.tsx`** (lista): liberar `onDelete` no `AcordoCard` quando `podeExcluirAcordos && acordo.user_id === user.id` e o acordo **não** tiver `tem_pago`. Continuar usando `delete_acordo_atomico`.

---

## 2. CPF duplicado: alerta em vez de bloqueio

A flag `permite_cpf_duplicado` já existe e Anna já está com `true`. Faltam ajustes:

### Banco
- Atualizar trigger `acordos_block_duplicate_cpf` para também permitir quando o `auth.uid()` tiver `user_permissions.permite_cpf_duplicado = true` (hoje só libera admin ou último acordo quebrado).

### Frontend `src/pages/NovoAcordo.tsx`
- Usar `podeExcluirAcordos`/`permiteCpfDuplicado` (já existe em `useUserPermissions`).
- Quando o CPF já tiver acordo lançado:
  - Se admin **ou** `permiteCpfDuplicado` → exibir **alerta amarelo** (não bloqueante) com texto: "⚠️ Atenção: este CPF já possui acordo lançado por **{nome do funcionário}** em **{data}**. Você pode prosseguir, mas confirme se realmente é um novo acordo."
  - Caso contrário, manter bloqueio atual (mensagem vermelha).
- O envio do formulário não fica mais bloqueado pela duplicidade quando o usuário tem permissão.

---

## 3. Aplicar permissão na Anna

Após a migração, rodar update para garantir:
```
pode_excluir_acordos = true
permite_cpf_duplicado = true  (já está)
```
no registro de `user_permissions` da Anna.

---

## Arquivos a criar / editar

**Migration (nova):**
- adicionar coluna `pode_excluir_acordos`
- atualizar `delete_acordo_atomico`
- criar `excluir_parcela_pendente`
- atualizar trigger `acordos_block_duplicate_cpf`

**Update de dados (insert tool):**
- setar `pode_excluir_acordos = true` para Anna

**Editados:**
- `src/hooks/useUserPermissions.tsx`
- `src/components/EditPermissionsDialog.tsx`
- `src/pages/AcordoDetalhe.tsx`
- `src/pages/Acordos.tsx`
- `src/pages/NovoAcordo.tsx`

Sem custos adicionais de Cloud (apenas mudanças de lógica e UI).
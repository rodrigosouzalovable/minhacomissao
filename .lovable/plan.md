## Objetivo

Permitir que a operadora **Anna Flavia Leite de Morais** marque parcelas como pagas (e desfaça) em **qualquer acordo lançado por qualquer usuário**, sem dar a ela acesso total de admin nem permissão para excluir/criar acordos.

## Abordagem

Criar uma nova permissão granular chamada `pode_marcar_pago_global` na tabela `user_permissions`, com política de RLS que libera apenas `UPDATE` na tabela `pagamentos` para usuários que tiverem essa flag ligada. Em seguida, ativar a permissão para a Anna Flavia.

Essa abordagem é segura porque:
- Não promove a Anna a admin.
- Não libera DELETE/INSERT em `pagamentos` nem em `acordos`.
- Fica reutilizável para liberar outras operadoras no futuro.

## Passos

### 1. Migração do banco
- Adicionar coluna `pode_marcar_pago_global boolean NOT NULL DEFAULT false` em `public.user_permissions`.
- Criar função `public.pode_marcar_pago_global(uid uuid)` (SECURITY DEFINER) que retorna true se a flag estiver ativa.
- Criar policy `"Marcar pago global pode atualizar pagamentos"` em `public.pagamentos` (FOR UPDATE) usando essa função.
- Habilitar a flag para Anna Flavia (`bb6a930c-c5e7-45c1-ab27-3cc4e63539f5`) via upsert em `user_permissions`.

### 2. UI (Admin → Usuários → Permissões)
- Em `src/components/EditPermissionsDialog.tsx`, adicionar um switch **"Pode marcar parcelas como pagas em qualquer acordo"** ligado à coluna nova, para que admins gerenciem essa permissão pela tela.
- Atualizar `src/hooks/useUserPermissions.tsx` para expor `podeMarcarPagoGlobal`.

### 3. Frontend de marcação de pago
- No componente que renderiza acordos de outros usuários (ex.: `AcordoDetalhe.tsx` / lista de parcelas), liberar o botão "Marcar como pago"/"Desfazer" também quando `podeMarcarPagoGlobal === true`, além das condições atuais (dono do acordo / admin / acordos compartilhados).

### 4. Verificação
- Logar como Anna, abrir um acordo de outro funcionário e confirmar que consegue marcar/desmarcar parcelas como pagas; verificar que continua sem botões de excluir acordo/parcela.

## Detalhes técnicos

```sql
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS pode_marcar_pago_global boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pode_marcar_pago_global(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _uid AND pode_marcar_pago_global = true
  )
$$;

CREATE POLICY "Marcar pago global pode atualizar pagamentos"
ON public.pagamentos FOR UPDATE TO authenticated
USING (public.pode_marcar_pago_global(auth.uid()))
WITH CHECK (public.pode_marcar_pago_global(auth.uid()));
```

E um upsert em `user_permissions` ligando a flag para o `user_id` da Anna.
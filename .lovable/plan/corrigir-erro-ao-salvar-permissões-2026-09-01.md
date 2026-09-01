# Corrigir erro ao salvar permissões

## O que está acontecendo

Encontrei a causa. A tabela de permissões tem as colunas de data chamadas `criado_em` e `atualizado_em`, mas o gatilho ligado a ela tenta gravar em uma coluna `updated_at`, que não existe nessa tabela. Resultado: qualquer **edição** de permissões falha no banco (criar do zero funciona, editar não), e a tela mostra apenas "Não foi possível salvar as permissões", sem detalhe.

Confirmado no banco: colunas `criado_em`/`atualizado_em`, gatilho `update_user_permissions_updated_at` executando uma função que faz `NEW.updated_at = now()`. As regras de acesso estão corretas (seu login é admin) — não é problema de permissão.

## Correção

1. Migração no banco: substituir o gatilho da tabela de permissões por uma função própria que atualiza `atualizado_em` (mantendo o histórico de alteração funcionando).
2. Mostrar a mensagem real de erro no aviso vermelho do diálogo de permissões, para que falhas futuras não fiquem genéricas.

## Detalhes técnicos

- Nova função `public.set_user_permissions_atualizado_em()` (`SECURITY INVOKER`, `SET search_path = public`) e recriação do trigger `BEFORE UPDATE ON public.user_permissions`.
- `src/components/EditPermissionsDialog.tsx`: `onError: (err)` passando `err.message` no `description` do toast.

## Verificação

Após a migração, executar uma atualização de teste na linha de permissões do seu usuário e confirmar que `atualizado_em` muda sem erro, e salvar pela interface.

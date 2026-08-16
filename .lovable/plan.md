# Corrigir cadastro de novo WhatsApp pelo login parceiro (Guilherme)

## Diagnóstico

O cadastro em si é permitido, o que falha é a leitura da linha recém-criada.

- O formulário insere a instância já com `user_id` = o próprio Guilherme e pede o `id` de volta (`insert ... select`).
- As regras de leitura de `meta_whatsapp_instances` para usuários em "Modo parceiro" só liberam linhas que já tenham vínculo na tabela `meta_instance_parceiros`.
- O vínculo automático é criado por gatilhos `AFTER INSERT`, que rodam **depois** da devolução da linha. Resultado: no instante do retorno o parceiro ainda não tem permissão de ver a própria linha e o banco responde "new row violates row-level security policy for table meta_whatsapp_instances".

Isso explica por que admins conseguem cadastrar e o Guilherme não, e por que as instâncias já existentes dele funcionam (o vínculo já existe).

## Correção

Uma migração ajustando a política de leitura/gestão para que o parceiro sempre veja as instâncias das quais ele é o dono (`user_id = auth.uid()`), além das vinculadas a ele.

Efeito prático:
- Guilherme cadastra o novo número normalmente e ele aparece na hora.
- Guilherme continua vendo **apenas** os números dele (os seus têm outro dono e nenhum vínculo com ele).
- Nada muda para admins e para os demais usuários.

## Detalhes técnicos

Migração em `meta_whatsapp_instances`:
- Recriar `Users manage own meta instances` com `USING (has_role(auth.uid(),'admin') OR (auth.uid() = user_id))`, removendo a exigência de vínculo para o próprio dono (o `WITH CHECK` continua igual).
- Recriar `meta_instances_parceiro_select` como `is_parceiro_meta(auth.uid()) AND (parceiro_tem_instancia(auth.uid(), id) OR auth.uid() = user_id)`; mesmo ajuste em `meta_instances_parceiro_update` / `meta_instances_parceiro_delete` para o parceiro poder editar/remover o que ele mesmo cadastrou.
- Manter `NOT is_parceiro_meta(...)` nas políticas de pasta/inbox compartilhado/tenant, preservando o isolamento atual.

Verificação: cadastrar um número de teste com um login parceiro e confirmar que ele aparece só para esse login, depois removê-lo.

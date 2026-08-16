# Liberar cadastro de BMs e WhatsApps para o Guilherme

## Causa do erro (verificado no banco)

- O login do Guilherme (`guilherme@gmail.com`) é `funcionario` e está marcado como **parceiro Meta**, com acesso às abas Inbox Meta, Envio Meta, Templates e API Oficial Meta.
- A tabela de Business Managers só aceita cadastro/edição/exclusão de **admin** (as regras de acesso exigem papel admin no insert). Por isso a mensagem "new row violates row-level security policy for table meta_business_managers".
- Para WhatsApps ele já consegue cadastrar (a regra permite quando o registro é do próprio usuário), mas hoje uma instância recém-criada por parceiro não aparece de volta na lista dele, porque a visualização de parceiro depende de um vínculo (`meta_instance_parceiros`) que não é criado automaticamente.

## O que será feito

1. **Cadastro de BMs liberado para parceiros Meta**, de forma isolada:
   - Cada BM passa a guardar quem a cadastrou.
   - O Guilherme pode criar, ver, editar e excluir **apenas as BMs cadastradas por ele**.
   - Ele continua sem ver as BMs da empresa (Facebook Edna, FB 17, BM Rodrigo Ribeiro), a não ser que tenha algum WhatsApp vinculado a elas.
   - Admins continuam vendo e gerenciando tudo.
   - O botão de "BM padrão" fica restrito a admin (evita que um parceiro troque a BM padrão da empresa).

2. **Cadastro de WhatsApps sem limite**, vinculado automaticamente a ele:
   - Ao cadastrar uma instância, o vínculo de parceiro é criado na hora, então ela aparece imediatamente na lista dele e nas abas Envio Meta/Inbox.
   - Ninguém além dele e dos admins vê essas instâncias.

3. **Tela API Oficial Meta**: o bloco de Business Managers passa a ficar visível para parceiros (hoje é área de admin), mostrando só as BMs dele, sem a ação de tornar padrão.

## Detalhes técnicos

- Migração:
  - `meta_business_managers`: nova coluna `criado_por uuid` (preenchida por trigger com `auth.uid()` no insert).
  - Novas políticas para `authenticated`: insert quando `is_parceiro_meta(auth.uid())` e `criado_por = auth.uid()`; select/update/delete de parceiro restritos a `criado_por = auth.uid()`. Políticas de admin permanecem.
  - Proteção de `padrao`: trigger que rejeita marcar `padrao = true` quando o usuário não é admin.
  - Trigger `AFTER INSERT` em `meta_whatsapp_instances`: se o criador é parceiro Meta, insere a linha correspondente em `meta_instance_parceiros` (idempotente).
- Frontend:
  - `ConfigurarMeta.tsx`: exibir a seção/aba de Business Managers também para usuários com `parceiro_meta`.
  - `BusinessManagersManager.tsx`: esconder a ação "tornar padrão" para não-admins; manter o restante do fluxo.
- Sem novos crons, polling ou Realtime — nenhum impacto de custo no Cloud.

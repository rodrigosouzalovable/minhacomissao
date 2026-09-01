# Isolar números Meta: parceiros não veem os seus, você não vê os deles

## O que está causando o vazamento

Verifiquei as regras de acesso da tabela de instâncias Meta. Existem duas regras criadas na fase do "Solution Partner" que liberam leitura e alteração de qualquer instância cujo campo `partner_client_id` esteja vazio:

- `meta_instances_cliente_parceiro_select`: `partner_client_id IS NULL OR ...`
- `meta_instances_cliente_parceiro_update`: mesma condição

Confirmei no banco: **nenhuma** das 108 instâncias tem `partner_client_id` preenchido. Ou seja, essa condição é verdadeira para todas as linhas e, na prática, qualquer usuário logado — inclusive os parceiros Meta — enxerga (e pode alterar) todos os números, anulando o isolamento por parceiro que já existe nas outras regras.

As demais regras estão corretas: parceiro só vê o que está vinculado a ele (`meta_instances_parceiro_select`), e as regras de pasta/inbox/tenant já excluem parceiros. A função usada pelo Inbox e pelo Envio (`pode_ver_instancia_meta`) também já está correta e não precisa mudar.

## O que vou corrigir

1. Substituir as duas regras `cliente_parceiro` por versões que só liberam quando o usuário é admin ou está realmente vinculado ao cliente-parceiro da instância — sem o atalho "campo vazio libera para todos".
2. Manter intacto: admin continua vendo tudo; funcionários continuam vendo pelas pastas/inbox; cada parceiro continua restrito às instâncias vinculadas a ele.
3. Depois da correção, conferir na prática, simulando o acesso de um usuário parceiro, que ele passa a receber apenas as instâncias vinculadas ao próprio login — e que o seu acesso admin continua listando todas.

Se algum parceiro deveria estar vendo mais números do que os vinculados a ele hoje, isso passa a ser resolvido apenas pelo vínculo explícito na aba Usuários (bloco "Modo parceiro"), como já funciona.

## Detalhes técnicos

Migração:

- `DROP POLICY meta_instances_cliente_parceiro_select` / `..._update` em `public.meta_whatsapp_instances`.
- Recriar SELECT/UPDATE com `USING (partner_client_id IS NOT NULL AND pode_ver_cliente_parceiro(auth.uid(), partner_client_id))`, deixando a autorização geral para as políticas existentes (`Users manage own meta instances`, `tenant_scope_all`, `meta_instances_folder_member_select`, `meta_instances_shared_select`, `meta_instances_parceiro_*`).
- Sem alteração de schema, de dados, de front-end ou de funções. Nenhum novo cron, polling ou Realtime — custo zero no Lovable Cloud.

Validação: consultas `SELECT` com `set local role authenticated` + `request.jwt.claims` do usuário parceiro e do admin, comparando as contagens antes/depois.

# Templates HSM não aparecem para o parceiro Thiago Nogueira

## O que está acontecendo

A sincronização funcionou: os 13 templates foram gravados no banco (6 + 6 + 1 nas três instâncias AMARAL). O problema é de permissão de leitura — a lista volta vazia para o login dele.

A tabela de templates sincronizados só é liberada hoje para:
- quem é o "dono" da instância (as instâncias AMARAL estão registradas no seu login de admin),
- administradores,
- quem tem inbox compartilhado ou pertence à empresa/tenant principal.

O Thiago não cai em nenhum desses casos — ele só tem o vínculo do Modo Parceiro com as 3 instâncias, que ainda não foi considerado nessa tabela. Por isso aparece "13 templates sincronizados" e logo abaixo "Templates HSM (0)".

## Correção

Aplicar uma regra de acesso na tabela de templates sincronizados equivalente à que já existe para as instâncias do parceiro: ele pode ver e gerenciar os templates das instâncias vinculadas a ele — e somente delas.

Depois disso, ao abrir a aba Templates HSM (ou clicar em sincronizar novamente), os 13 templates das instâncias AMARAL aparecem no login dele, com status e cobertura, sem exibir nenhum template dos seus números.

## Detalhes técnicos

Migração em `meta_whatsapp_templates`:
- Nova policy `meta_templates_parceiro_all` (ALL, role `authenticated`) com `USING`/`WITH CHECK` = `public.pode_ver_instancia_meta(auth.uid(), instancia_id)` — a mesma função `security definer` já criada para o Modo Parceiro (admin vê tudo; parceiro só as instâncias vinculadas em `meta_instance_parceiros`).
- Ajustar `meta_templates_shared_select` e `tenant_scope_all` para exigir `NOT public.is_parceiro_meta(auth.uid())`, mantendo o isolamento (parceiro não herda acesso por inbox compartilhado/tenant), sem mudar o comportamento dos demais usuários.
- Conferir/garantir os GRANTs de Data API (`authenticated`: SELECT/INSERT/UPDATE/DELETE; `service_role`: ALL).

Nenhuma alteração de frontend é necessária: `src/pages/ConfigurarMeta.tsx` já consulta a tabela e passará a receber as linhas permitidas.

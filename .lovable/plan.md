# Parceiros com números Meta isolados

Objetivo: liberar as abas **Envio Meta** e **API Oficial Meta** para o login do Thiago Nogueira, mostrando apenas as instâncias vinculadas a ele (AMARAL 62 8232-4186, AMARAL 62 8237-0544, AMARAL 62 8271-1628), sem nenhum contato com as suas 32 instâncias. O mesmo mecanismo servirá para os próximos parceiros.

## Como vai funcionar na prática

1. Na aba **Usuários > Editar Permissões**, além das abas visíveis, aparece um novo bloco **"Modo parceiro (números próprios)"**:
   - Um interruptor "Parceiro com números próprios".
   - Com ele ligado, aparece a lista de todas as instâncias Meta com busca e checkbox — você marca as três AMARAL.
   - Você marca as abas "Envio Meta" e "API Oficial Meta" normalmente.
2. Ao entrar, o Thiago vê **somente** os números vinculados a ele em API Oficial Meta e em Envio Meta: seleção de instâncias, BMs, saúde/qualidade, campanhas e histórico só dos números dele.
3. Todo novo WhatsApp que **ele mesmo cadastrar** já nasce vinculado ao login dele automaticamente (dono automático) — sem precisar de você.
4. Ele passa a poder criar e gerenciar os **templates HSM** apenas dos números dele (hoje isso é só admin). Ele não vê nem edita templates dos seus números.
5. Você (admin) continua vendo tudo, inclusive os números e campanhas dele, como hoje.

## O que garante que nada se misture

- As campanhas já são por dono, então as campanhas dele nunca aparecem para você e vice-versa (você, como admin, tem visão total).
- Uma instância só é visível para o parceiro se estiver explicitamente vinculada a ele.
- Nenhum número seu passa a ser visível para nenhum parceiro, mesmo que ele tenha alguma outra permissão antiga ligada (inbox compartilhado, pastas etc. deixam de dar acesso a instâncias quando o modo parceiro está ativo).

## Detalhes técnicos

**Banco de dados (migração)**
- Nova tabela `meta_instance_parceiros (instancia_id uuid, user_id uuid, criado_em)`, PK composta, com GRANTs (`authenticated` select, `service_role` all) e RLS: admin gerencia; o parceiro lê as próprias linhas.
- Nova coluna `user_permissions.parceiro_meta boolean default false`.
- Funções `security definer`:
  - `is_parceiro_meta(uuid)` — lê o flag.
  - `pode_ver_instancia_meta(uuid uid, uuid instancia)` — true para admin; para parceiro, só se existir vínculo; para os demais usuários, mantém a regra atual.
- Políticas de `meta_whatsapp_instances`: reescrever `meta_instances_folder_member_select`, `meta_instances_shared_select` e `tenant_scope_all` para exigir `NOT is_parceiro_meta(auth.uid())`, e adicionar `meta_instances_parceiro_select/update` baseada no vínculo. Assim o parceiro fica restrito ao próprio conjunto e o comportamento dos outros usuários não muda.
- Políticas de `meta_templates_mestre` e `meta_templates_instancia`: além de admin, permitir parceiro quando a instância referenciada estiver vinculada a ele.
- `meta_business_managers`: liberar SELECT para parceiro apenas das BMs usadas pelas instâncias dele.
- `get_meta_whatsapp_active_instances_for_sending()` passa a filtrar por `pode_ver_instancia_meta(auth.uid(), i.id)` (hoje retorna todas, ignorando RLS por ser SECURITY DEFINER).
- Trigger em `meta_whatsapp_instances`: se o criador for parceiro, insere o vínculo automaticamente.
- Backfill: vincular as 3 instâncias AMARAL ao user `a3e72fe9-...` (Thiago Nogueira) e ligar `parceiro_meta` para ele — feito por operação de dados, revisável por você.

**Frontend**
- `EditPermissionsDialog.tsx`: novo bloco com switch `parceiro_meta` + lista de instâncias com busca; salva vínculos em `meta_instance_parceiros` (diff add/remove, igual ao que já é feito com tenants).
- `useUserPermissions.tsx`: expor `parceiroMeta`.
- `ConfigurarMeta.tsx` e `EnvioMeta.tsx`: nenhuma regra nova de negócio — as consultas passam a devolver apenas as instâncias permitidas pelas políticas; ajustar somente os pontos que hoje dependem de `isAdmin` para liberar cadastro/edição de instância e templates ao parceiro.
- `MetaTemplates.tsx`: liberar acesso ao parceiro restrito às instâncias dele.

**Fora de escopo**: Inbox Meta Oficial isolado, monitor de envios e aquecimento para o parceiro (você optou por manter só Envio + API Oficial + templates).

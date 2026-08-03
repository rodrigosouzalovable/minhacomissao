# Sincronizar nome oficial e foto de perfil das instâncias Meta

Sim, é possível. A Meta expõe, para cada número, o nome verificado (`verified_name`) e o perfil do WhatsApp Business (foto e "sobre"). Hoje o sistema já consulta o nome verificado ao "Verificar saúde", mas não o salva nem exibe — e a foto não é consultada em nenhum lugar.

## O que vai mudar

1. Ao clicar em "Verificar saúde" no diálogo de Instâncias (Envio Meta), o sistema também busca:
   - nome oficial exibido na Meta (verified_name) e status desse nome;
   - foto de perfil do WhatsApp Business e o texto "sobre".
2. Cada card de instância passa a mostrar a foto de perfil (avatar circular à esquerda) e, abaixo do apelido interno, o nome oficial da Meta. Se o apelido interno for diferente do nome oficial, aparece uma marcação discreta "nome na Meta: X".
3. Botão "Sincronizar perfis" no diálogo, para atualizar nome/foto de todas as instâncias sem rodar a checagem completa de saúde.
4. Os mesmos dados aparecem nos cards da aba "API oficial Meta" (Configurar Meta), para manter consistência.

Observação: a URL da foto que a Meta devolve é temporária (expira em algumas horas). Para a foto não quebrar, ela é baixada e guardada em um bucket público de avatares no backend, e o card usa essa cópia — atualizada a cada sincronização.

## Detalhes técnicos

- Migração em `meta_whatsapp_instances`: novas colunas `meta_verified_name text`, `meta_name_status text`, `meta_profile_pic_url text`, `meta_profile_about text`, `meta_perfil_sync_em timestamptz`. Sem mudança de RLS (políticas atuais continuam valendo).
- Nova Edge Function `meta-sync-perfil-instancias` (aceita `instancia_id` opcional):
  - `GET /{phone_number_id}?fields=verified_name,name_status,display_phone_number`
  - `GET /{phone_number_id}/whatsapp_business_profile?fields=profile_picture_url,about`
  - baixa a imagem e faz upload em bucket público `meta-perfis` no caminho `{phone_number_id}.jpg` (upsert), gravando a URL pública na coluna.
  - persiste as colunas novas + `meta_perfil_sync_em`; erros por instância não interrompem as demais.
- `check-meta-instance-health/index.ts`: passa a persistir `meta_verified_name`/`meta_name_status` já retornados pela Graph API e dispara a sincronização de perfil na mesma execução.
- `src/pages/EnvioMeta.tsx`: incluir as colunas novas no select das instâncias, renderizar `Avatar` + nome oficial no card, e adicionar o botão "Sincronizar perfis" chamando a nova função.
- `src/pages/ConfigurarMeta.tsx`: exibir avatar e nome oficial no card de cada instância.
- Custo: chamadas à Graph API são gratuitas; o impacto é apenas 2 requisições por instância por sincronização (manual, sem cron novo).

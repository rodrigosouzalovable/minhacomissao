## Objetivo
Criar uma aba de gerenciamento de **Meta App IDs por BM (Business Manager)**, permitindo cadastrar, editar e escolher qual App ID usar ao enviar templates para aprovação da Meta.

## Por que
Hoje só existe uma chave única `meta_app_id` em `meta_whatsapp_config`. Como você tem múltiplas BMs (ex.: `1041751302126373` e `2328366971280850`) e criará novas, precisamos suportar vários App IDs e associar cada instância WhatsApp ao App ID correto.

## Escopo

### 1. Backend (migration)
Nova tabela `meta_business_managers`:
- `id` (uuid, pk)
- `nome` (texto — ex.: "BM Principal", "BM Certificadora")
- `app_id` (texto, único)
- `business_id` (texto, opcional — o `business_id` da URL do Facebook)
- `descricao` (texto, opcional)
- `ativo` (bool)
- `padrao` (bool — marca qual App ID é usado por padrão)
- `created_at`, `updated_at`

GRANT + RLS: leitura/escrita apenas para admins (via `has_role`).

Adicionar coluna `meta_bm_id uuid` em `meta_whatsapp_instances` (FK opcional para `meta_business_managers.id`) para vincular cada instância à sua BM.

Migrar o valor atual de `meta_whatsapp_config.meta_app_id` (`1041751302126373`) como primeira BM padrão, e inserir também `2328366971280850` como segunda BM.

### 2. Frontend
Nova aba **"Business Managers"** em `/admin/meta-templates` (ou página dedicada em `/admin/meta-business-managers`):
- Lista das BMs cadastradas com App ID, business_id, status, botão padrão.
- Formulário para **Adicionar nova BM** (nome, app_id, business_id opcional, descrição).
- Editar / desativar / definir como padrão.

Na aba de instâncias Meta, permitir escolher a **BM** de cada instância (dropdown das BMs ativas).

### 3. Edge function (envio de template)
Atualizar a função que envia template para Meta:
- Buscar o App ID pela BM vinculada à instância; se não houver, cair no App ID marcado como `padrao=true`; se nenhum, retornar o erro atual.
- Isto substitui o lookup fixo em `meta_whatsapp_config.meta_app_id` (que fica só como fallback/legado).

## Detalhes técnicos
- Não removeremos `meta_whatsapp_config.meta_app_id` agora — ele fica como fallback para não quebrar nada.
- Todos os GRANTs na tabela nova + RLS admin-only.
- UI segue design system existente (shadcn tabs / cards / forms).

## Fora de escopo
- Multi-tenant real (cada empresa com sua BM isolada) — permanece admin global.
- Rotação automática de App IDs / balanceamento entre BMs.

Confirma que posso implementar assim?
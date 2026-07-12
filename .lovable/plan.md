## Objetivo

Nos cards da aba "API Oficial Meta" (ConfigurarMeta):

1. Poder **vincular cada número a uma Business Manager cadastrada** (usando as BMs de `meta_business_managers`).
2. O botão **"WhatsApp Manager"** abrir automaticamente na URL da BM correta desse número.
3. Poder **editar o número (display_phone)** direto no card, e esse valor refletir também na aba **Envio Meta (Massa)**.

## Estado atual

- Tabela `meta_whatsapp_instances` já tem a coluna `meta_bm_id uuid` (FK lógica para `meta_business_managers.id`) — só não está sendo usada na UI.
- Tabela `meta_business_managers` tem `business_id` (Business ID) e `nome`.
- Botão "WhatsApp Manager" hoje usa `inst.business_id` (o campo direto na instância), que pode não estar preenchido / não refletir a BM real.
- Aba Envio Meta lê `display_phone` da mesma tabela `meta_whatsapp_instances`, então basta editar essa coluna que sincroniza automaticamente.

## Mudanças

### 1. Card da instância Meta (`src/pages/ConfigurarMeta.tsx`)

Em cada card adicionar:

- **Select "Business Manager"**: lista as BMs ativas de `meta_business_managers` (mesmo hook que já existe no `BusinessManagersManager`). Ao trocar, faz `UPDATE meta_whatsapp_instances SET meta_bm_id = ? WHERE id = ?`. Mostra o nome da BM vinculada abaixo do nome da instância como badge (ex.: `BM Certificadora`).
- **Campo editável "Número (display_phone)"**: input inline com botão salvar/lápis. Ao salvar, `UPDATE meta_whatsapp_instances SET display_phone = ? WHERE id = ?`. Validação: só dígitos, mín. 10.
- **Botão "WhatsApp Manager"** passa a resolver o `business_id` assim:
  1. Se `inst.meta_bm_id` estiver setado → busca a BM correspondente e usa `bm.business_id`.
  2. Senão, fallback para `inst.business_id` (comportamento atual).
  3. URL: `https://business.facebook.com/latest/whatsapp_manager/phone_numbers?business_id={bmBusinessId}&asset_id={inst.waba_id}`.
  4. Se não houver `business_id` resolvido, exibe toast "Vincule uma BM primeiro".

### 2. Carregamento de BMs

- No `ConfigurarMeta.tsx`, adicionar um `useEffect` que carrega `meta_business_managers` ativas uma vez (ordenadas por `padrao desc, nome`) e guarda em estado local para popular os selects. Após vincular/editar, dá `refetch` da lista de instâncias existente.

### 3. Envio Meta (Massa)

- **Nenhuma mudança de código.** A aba já lê `display_phone` de `meta_whatsapp_instances` — a edição feita no card se propaga automaticamente ao próximo carregamento do painel.

## Fora de escopo

- Não alterar schema (coluna `meta_bm_id` já existe).
- Não mexer em webhook, envio, saúde da instância, pool, ou em qualquer edge function.
- Não editar `access_token`, `waba_id`, `phone_number_id` no card (fora do pedido).

## Arquivos afetados

- `src/pages/ConfigurarMeta.tsx` — único arquivo alterado.

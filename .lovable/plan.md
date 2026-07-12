## Objetivo
Adicionar um botão **"Abrir WhatsApp Manager"** em cada card da aba **Instâncias** da página **Configurar Meta** (API Oficial Meta), abrindo direto o Gerenciador do WhatsApp da Meta em nova aba — mesmo comportamento que já existe no HookCloud.

## Onde
`src/pages/ConfigurarMeta.tsx`, no bloco de botões de ação do card (linhas ~502–515, junto de Testar / Templates / Power / Trash).

## Como
- Novo `<Button size="sm" variant="outline">` com ícone `ExternalLink` e texto "WhatsApp Manager".
- Ao clicar: `window.open(url, "_blank", "noopener,noreferrer")`.
- URL construída a partir dos campos já existentes na `meta_whatsapp_instances`:
  ```
  https://business.facebook.com/latest/whatsapp_manager/phone_numbers?business_id={inst.business_id}&asset_id={inst.waba_id}
  ```
- Se `business_id` estiver vazio, cai em fallback só com `asset_id` (a Meta ainda abre o gerenciador daquela WABA).
- Se `waba_id` estiver vazio, o botão fica desabilitado.

## Fora de escopo
- Não altera nenhuma lógica de envio, sincronização, banco ou webhook.
- Não mexe em outras páginas (Inbox Meta, Envio Meta, Pool). Se depois você quiser o mesmo botão lá, faço em outra passada.

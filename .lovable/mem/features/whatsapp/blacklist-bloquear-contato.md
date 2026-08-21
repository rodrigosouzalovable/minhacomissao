---
name: Blacklist "Bloquear contato"
description: Cliente que clica/responde "Bloquear contato" entra na blacklist e nunca mais recebe campanha; toggle "Bloquear Blacklist" na aba Envio Meta
type: feature
---

- Toggle **Bloquear Blacklist** na aba "Envio Meta" (card "4. Delay e disparo"), persistido em `meta_envio_pool_config.blacklist_ativa` (default `true`).
- Detecção no webhook `meta-whatsapp-webhook` via helper `ehPedidoBloqueioContato` (`_shared/iago.ts`): resposta de botão ou texto "Bloquear contato", "não quero mais receber", "descadastrar", etc.
- Ao detectar: grava em `meta_destinatario_supressao` com `motivo` iniciado por `blacklist:` (sufixo de 8 dígitos), etiqueta "Aguardando Humano" e o IAGO NÃO responde a essa mensagem.
- `envio-meta-massa-iniciar` separa os motivos: `supressao_ativa` filtra falhas de entrega; `blacklist_ativa` filtra os motivos `blacklist:*`.

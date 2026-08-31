---
name: Liberar YELLOW/RED global (Meta)
description: Chave meta_envio_pool_config.liberar_qualidade_global ignora quarentena/pausa por qualidade e modo recuperação para todos os usuários
type: feature
---

`meta_envio_pool_config.liberar_qualidade_global` (switch no PoolMetaPanel):

- Quando ligada, YELLOW/RED podem disparar normalmente — `pick-meta-instance`, `envio-meta-massa-iniciar`, `envio-meta-massa-control` (instâncias livres e liberar teto) e `send-whatsapp-meta` ignoram quarentena, `estado_pool = 'restrita'`, pausa `quality=*` e `recuperacao_ativa`.
- `check-meta-instance-health` não reaplica pausa por qualidade, quarentena nem liga recuperação enquanto a chave estiver ligada.
- Bloqueios reais da Meta continuam valendo: pausa `status=BANNED/FLAGGED/RESTRICTED`, ban_info e pendência de pagamento.

## Causa do erro

O erro **"Method Not Allowed"** vem direto da UAZAPI. Nossa edge function `uazapi-set-proxy` está chamando um endpoint que **não existe** na API v2:

- Atual (errado): `POST /instance/updateProxy` com body `{ enabled, proxy: {...} }`
- Correto na UAZAPI v2:
  - `POST /instance/proxy` → cadastrar/alterar proxy (body **plano**)
  - `DELETE /instance/proxy` → remover proxy
  - `GET /instance/proxy` → consultar

Como o caminho `/instance/updateProxy` não aceita POST, o servidor responde **405 Method Not Allowed**. Por isso todas as instâncias falham igual, independente da credencial. Suas proxies (`144.225.3.4:12323:14a3a2169e1ed:dca71c87d7` etc.) estão em formato `host:port:user:pass` e estão corretas — o problema é só no endpoint.

Body correto esperado pela UAZAPI:
```json
{ "host": "144.225.3.4", "port": 12323, "protocol": "socks5", "username": "14a3a2169e1ed", "password": "dca71c87d7" }
```

## O que será alterado

### 1. `supabase/functions/uazapi-set-proxy/index.ts`
- Quando `enabled = true`: `POST /instance/proxy` com `{ host, port, protocol, username, password }` (campo correto é `protocol`, não `type`).
- Quando `enabled = false` (ou desativando): `DELETE /instance/proxy` para remover o proxy da instância na UAZAPI.
- Manter persistência em `user_whatsapp_instances` (`proxy_aplicado_em`, `proxy_ultimo_erro`) e o delay 1–3s entre instâncias.
- Continuar tratando `disconnected/timeout` como `fallback:true` com HTTP 200 (regra do projeto).

### 2. `whatsapp-qr` (auto-aplicação do proxy padrão em novas instâncias)
- Atualizar a chamada para usar `POST /instance/proxy` com o mesmo body plano.

### 3. Importação rápida (qualidade de vida — opcional, no mesmo passo)
- Adicionar no componente `AquecimentoProxiesTab.tsx` um campo "Colar lista" que aceita linhas no formato `host:port:user:pass` e distribui automaticamente entre as instâncias selecionadas (round-robin) — útil para suas 5 proxies acima. Se preferir manter como está hoje (digitação manual / aplicar a mesma em massa), basta avisar e eu pulo este item.

## Após o deploy
- Abrir a instância "62981941073 MEMU 21 15/04" → preencher `144.225.3.4 / 12323 / 14a3a2169e1ed / dca71c87d7` → "Salvar e aplicar na UAZAPI".
- O badge deve passar de "Erro: Method Not Allowed" para "Aplicado".

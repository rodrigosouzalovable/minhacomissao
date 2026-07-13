## Diagnóstico

O sistema já recebeu mensagens de outras instâncias (LD 13, IPHONE B1, Novo Mundo 3144) nos últimos minutos, mas **nenhum webhook chegou pela WABA da LD 19** (`waba_id=1428755208708722`). A instância existe, está ativa, tem `access_token`, e envia mensagens normalmente — o que falha é a Meta entregar os **eventos de entrada** pra ela. Isso é sintoma clássico de WABA sem `subscribed_apps` apontando pro webhook do sistema (ou apontando pra um callback antigo).

Confirmado no banco:
- Único registro em `meta_whatsapp_mensagens` da LD 19 hoje é a saída (template Soluti) — nenhuma entrada com sufixo `91672674`.
- Logs do `meta-whatsapp-webhook` (últimos 10min) não mostram nenhum POST com `phone_number_id=1145666058620665`.

Já existe a edge function `meta-subscribe-waba` que faz exatamente o `POST /{waba_id}/subscribed_apps` com `override_callback_uri` correto — só não está sendo chamada pra LD 19.

## Correção

1. **Invocar `meta-subscribe-waba` para a LD 19** (uma vez) passando `{ instancia_id: "cbe0a7fb-f979-4839-87e4-0221b7be1a78" }`. Isso re-inscreve a WABA no callback certo do projeto usando o `access_token` já salvo. Retorno inclui `subscribe_ok` e a lista atual de `subscribed_apps` pra confirmar.

2. **Verificar** com nova consulta em `meta_whatsapp_mensagens` (filtrando `instancia_id` da LD 19 e `direcao=entrada`) que a resposta do seu número pessoal aparece após o re-subscribe (pedir pra você mandar mais uma resposta pelo WhatsApp).

3. **Se ainda não chegar após o re-subscribe**, checar em `subscriptions` no retorno da função se o `callback_uri` bate exatamente com `${SUPABASE_URL}/functions/v1/meta-whatsapp-webhook` e se o app está listado. Se não bater, a causa é token da WABA sem permissão `whatsapp_business_messaging` + `whatsapp_business_management` — nesse caso é preciso regenerar o system-user token da BM dessa WABA.

Nenhuma alteração de código é necessária — a função de re-subscribe já existe e cobre o caso. A ação é operacional: rodar `meta-subscribe-waba` para a LD 19 e você reenviar uma mensagem-teste pra confirmar.
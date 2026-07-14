# Por que a mensagem não aparece no Inbox

Enviar funciona só com o Phone ID + Access Token. **Receber** exige que a WABA esteja assinada no nosso webhook — isso é uma configuração do lado da Meta, não é automático quando você cadastra o número aqui.

Faltam 3 passos do lado da Meta para o número `62981626668` (WABA `1706273477111603`):

1. **Configurar Webhook da WABA** apontando para a URL do nosso endpoint `meta-whatsapp-webhook`, com o Verify Token que já está salvo em `meta_whatsapp_config`.
2. **Subscrever o app à WABA** no campo `messages` (e demais eventos).
3. **Confirmar** que o número aparece como inscrito.

Já existe a função `meta-subscribe-waba` que faz os passos 1 e 2 automaticamente via Graph API (usando `override_callback_uri` + `verify_token`). Só que ela não está sendo disparada quando você cadastra um número novo manualmente com token permanente próprio.

# Plano

## 1. Rodar o subscribe para o número atual (imediato)
- Executar `meta-subscribe-waba` passando `instancia_id = cd197b9f-d6a0-4fd1-98f1-78e5edddad8c` para inscrever a WABA `1706273477111603` no webhook.
- Retornar o `subscriptions` da Meta para confirmar visualmente que a WABA aparece inscrita no nosso App ID.
- Você manda uma mensagem de teste do seu número pessoal e deve cair no Inbox em segundos.

## 2. UI: botão "Reinscrever webhook" no card da instância
Na tela onde aparece esse card (`62981626668 | Ativa | Sem BM vinculada | WhatsApp Manager | Testar | Templates | ⏻ | 🗑`), adicionar um botão **"Reinscrever webhook"** ao lado de "Testar" que chama `meta-subscribe-waba` para aquela instância e mostra toast com:
- ✅ "Webhook inscrito — mensagens recebidas passarão a aparecer no Inbox"
- ❌ mensagem humanizada em caso de erro (token sem permissão `whatsapp_business_management`, WABA de outra BM, etc.)

## 3. Auto-inscrever ao cadastrar instância nova
No fluxo de cadastro manual de instância Meta (onde você colou Phone ID + WABA + Token), após o `INSERT` bem-sucedido, chamar `meta-subscribe-waba` com o `instancia_id` recém-criado. Se falhar, avisar em toast mas deixar a instância salva — o botão do passo 2 permite reinscrever depois.

## 4. Checklist visual "Sem BM vinculada"
O badge cinza "Sem BM vinculada" no card é só informativo (não impede receber mensagens), mas vou trocar o tooltip para explicar: "Vincular BM é opcional para receber mensagens. Necessário só para faturamento consolidado."

# Detalhes técnicos

- Endpoint webhook: `${SUPABASE_URL}/functions/v1/meta-whatsapp-webhook`
- Verify Token: linha `chave='webhook_verify_token'` em `meta_whatsapp_config`
- Graph API: `POST /{waba_id}/subscribed_apps` com `override_callback_uri` + `verify_token` (já implementado em `meta-subscribe-waba/index.ts`)
- Permissões que o token permanente precisa ter: `whatsapp_business_messaging` (envio) **+** `whatsapp_business_management` (subscribe). Se você gerou o token só com a primeira, o subscribe falhará com erro 200 — nesse caso preciso avisar você para gerar um novo token com as duas permissões.

# Fora do escopo

- Não vou mexer na função `meta-whatsapp-webhook` (recebimento em si já funciona — é só falta de subscribe).
- Não vou tocar em RLS, migrations ou schema.
- Fluxo de BM permanece opcional.

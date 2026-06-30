## Diagnóstico

Verifiquei o backend:

- **Webhook está online e respondendo o verify challenge** (testei GET com o token `hk-meta-...` → retornou 200 com o challenge).
- **As tabelas `meta_whatsapp_mensagens` e `meta_whatsapp_contatos` estão vazias (0 linhas)**.
- **Não há nenhum log de POST** chegando na função `meta-whatsapp-webhook` desde que ela foi criada.

Conclusão: a função está saudável — quem **não está enviando** os POSTs é a Meta. Isso acontece em um destes 2 cenários (ambos resolvidos do lado da Meta, não no código):

1. No app da Meta (Meta for Developers → WhatsApp → Configuration → Webhooks), o **campo `messages` não está assinado** (precisa estar marcado em "Webhook fields").
2. Cada **WABA (WhatsApp Business Account) precisa "Subscribe" o app** via `POST /{waba_id}/subscribed_apps`. Sem isso, mesmo com o webhook salvo, a Meta não envia eventos daquele número.

Como o sistema tem 3 instâncias (3 `phone_number_id` ativos), o passo 2 precisa ser feito para cada WABA — e isso normalmente é o que está faltando.

## Plano de correção

### 1. Nova Edge Function `meta-subscribe-waba`
Para cada `meta_whatsapp_instances` ativa, chamar:

```
POST https://graph.facebook.com/v21.0/{waba_id}/subscribed_apps
Authorization: Bearer {access_token}
```

e em seguida `GET /{waba_id}/subscribed_apps` para confirmar. Retorna o resultado por instância (sucesso / erro Meta) para exibir na UI.

### 2. Botão "Assinar webhook (Meta)" em `ConfigurarMeta.tsx`
- Lista as 3 instâncias com status atual.
- Botão único "Assinar todas" que chama a função acima.
- Mostra ✅/❌ por número com a mensagem de erro retornada pela Meta (ex.: token sem permissão `whatsapp_business_management`).

### 3. Endpoint de diagnóstico em `meta-whatsapp-webhook`
Adicionar um `console.log` no início do POST (`req.method === 'POST'`) com o `phone_number_id` recebido, para nas próximas mensagens conseguirmos confirmar via `edge_function_logs` que a Meta passou a chamar — hoje não temos nenhum log de POST.

### 4. Instruções claras na UI
Mostrar em `ConfigurarMeta.tsx` o checklist:
- Webhook URL: `https://cymdrkeukockakfzjeen.supabase.co/functions/v1/meta-whatsapp-webhook`
- Verify token: `hk-meta-1f23f650-9e46-4f29-aee9-0f52310c6b8c`
- Campo a assinar: **messages** (obrigatório)
- Botão para rodar o subscribe automático nas 3 WABAs.

### Detalhes técnicos
- Arquivos novos: `supabase/functions/meta-subscribe-waba/index.ts`.
- Arquivos editados: `src/pages/ConfigurarMeta.tsx`, `supabase/functions/meta-whatsapp-webhook/index.ts` (apenas log extra).
- Sem mudança de schema, sem nova tabela, sem custo adicional.

Depois de aplicar e clicar em "Assinar todas", você manda uma mensagem de teste para um dos 3 números e em ~5s ela aparece na aba **Inbox Meta Oficial**.
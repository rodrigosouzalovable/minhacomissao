## Problema

Hoje o webhook Meta só grava mensagens **recebidas** (`messages` com `from` = cliente). Quando você responde pelo WhatsApp Web / celular no modo coexistência (Cloud API + app), a Meta envia esses envios como **echoes** — e o webhook atual ignora eles, então a conversa não atualiza no sistema.

## Sim, é possível

A Meta manda esses envios em dois lugares do webhook que hoje não tratamos:

1. **`message_echoes`** — campo separado que precisa estar assinado no app da Meta. Contém as mensagens que você enviou pelo aparelho/Web, com `from` = seu número business.
2. **`statuses`** com `origin.type = "business_initiated"` fora do nosso fluxo — usado para conciliar.

## O que vou fazer

### 1. Edge function `meta-whatsapp-webhook`
- Detectar quando `change.field === "message_echoes"` **ou** quando uma mensagem em `messages` tem `from` igual ao número da instância (`display_phone_number`).
- Inserir como `direcao = "saida"` em `meta_whatsapp_mensagens`, com `wa_message_id` para dedup (evita duplicar quando a mensagem sai pelo próprio sistema).
- Atualizar `ultima_mensagem` / `ultima_mensagem_em` do contato, **sem** incrementar `nao_lido` (é envio nosso).
- Criar o contato se ainda não existir (primeira interação vinda do celular).

### 2. Edge function `meta-subscribe-waba`
- Incluir `message_echoes` na lista de campos assinados ao clicar em "Assinar instâncias".

### 3. Instrução ao usuário
Depois do deploy, é preciso reassinar as instâncias uma vez (botão já existente em Configurar Meta) para a Meta começar a enviar os echoes. Também exige que a conta esteja em **modo coexistência** habilitado pela Meta — se o número for Cloud API puro (sem app), não haverá WhatsApp Web para responder, então isso não se aplica.

## Detalhes técnicos

- Dedup: se o `wa_message_id` já existir (envio feito pelo próprio sistema via `send-whatsapp-meta-text`), o insert é ignorado pelo UNIQUE. Assim mensagens enviadas por aqui não duplicam.
- `tipo_conteudo` e `conteudo` reutilizam a função `extractTextoFromMessage` existente.
- Timestamp: `m.timestamp` do echo.

Nenhuma mudança de UI — o `InboxMeta.tsx` já renderiza `direcao = "saida"` corretamente.

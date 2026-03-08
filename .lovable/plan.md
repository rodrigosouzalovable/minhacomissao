

# Notificar admin quando a IA não entender o cliente

## Resumo
Quando o chatbot não conseguir interpretar a resposta do cliente em qualquer etapa da negociação, em vez de enviar uma mensagem genérica de "não entendi", ele vai:
1. **Não responder nada ao cliente** (fica em silêncio)
2. **Enviar uma notificação via WhatsApp** para o número 62991672674 informando o ocorrido
3. **Marcar a conversa como "aguardando_humano"** para que o chatbot não responda até ser desbloqueado

## Sobre o chat de ensino
Não, você **não precisa ensinar isso pelo chat da IA**. Essa lógica será implementada diretamente no código do chatbot. O chat de ensino serve para criar regras de gatilho/resposta, mas esse comportamento é uma mudança no fluxo principal.

## Mudanças no `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Função `notificarAdmin`
Criar uma função auxiliar que envia mensagem para `5562991672674` usando as credenciais da instância atual:

```
Olá Rodrigo, na mensagem enviada pelo número {telefone_cliente} para o número {telefone_instancia}, o cliente respondeu algo que eu não soube informar: "{texto}". Você poderia analisar por favor?
```

O número da instância será extraído do payload do webhook (`payload.phone` ou similar).

### 2. Substituir respostas de "não entendi" por notificação + silêncio
Nos seguintes pontos do fluxo, quando a IA não entende:
- **oferta_valores** (linha ~696): cliente não escolheu à vista nem parcelado
- **aguardando_pagamento_hoje** (linha ~736): resposta ambígua
- **aguardando_data** (linha ~761): data não identificada
- **proposta_enviada** (linha ~643): resposta ambígua (que não é sim nem não)

Em cada caso: salvar etapa como `aguardando_humano`, notificar o admin, e **não enviar nada** ao cliente.

### 3. Nova etapa `aguardando_humano`
Adicionar um case no switch para `aguardando_humano` que simplesmente ignora mensagens do cliente (não responde) e notifica o admin novamente se o cliente insistir.

### 4. Desbloqueio manual
O admin poderá desbloquear a conversa respondendo diretamente ao cliente pelo WhatsApp. Quando o chatbot detectar uma mensagem `fromMe` para esse telefone, ele volta a conversa para a etapa anterior ou reseta para `novo`.

## Arquivos alterados
- `supabase/functions/whatsapp-chatbot/index.ts` — adicionar `notificarAdmin`, nova etapa `aguardando_humano`, substituir fallbacks


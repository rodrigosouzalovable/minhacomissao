## O que aconteceu (verificado no banco)

A conversa **existe**, o webhook funcionou. Verifiquei os registros:

- Mensagem de entrada "oi" gravada às 21:57 na instância Novo Mundo 3144 — OK.
- O contato (`Rodrigo`, instância Novo Mundo 3144) foi atualizado com a mensagem "oi", mas está com **`arquivado = true`**.
- A aba "Conversas" só lista contatos com `arquivado = false` — por isso a conversa não aparece (ela está na aba "Arquivados").

Causa raiz: **nada no sistema desarquiva um contato quando chega resposta do cliente ou quando abrimos nova conversa com ele**. Uma vez arquivado (manualmente ou pela rotina de retenção de 3 dias), o contato fica invisível na lista principal mesmo com mensagens novas e não lidas.

Problema secundário confirmado: o telefone do contato está gravado como `556291672674` (12 dígitos, sem o 9) porque foi criado pelo envio, enquanto a Meta devolve `5562991672674` (13 dígitos). A busca por telefone usa `ilike %digitos%`, então procurar por "62991672674" não encontra esse contato. As mensagens do histórico não são afetadas (o chat já casa por sufixo de 8 dígitos).

## Correções

1. **Webhook `meta-whatsapp-webhook`**: ao receber mensagem de entrada (não-echo), incluir `arquivado: false` na atualização do contato — qualquer resposta do cliente traz a conversa de volta à lista.
2. **`send-whatsapp-meta`**: ao atualizar contato existente num novo envio, também setar `arquivado: false` — abrir nova conversa reativa o contato.
3. **Busca no Inbox (`src/pages/InboxMeta.tsx`)**: quando o termo tiver 8+ dígitos, buscar também por sufixo (`telefone.ilike.%<8 últimos dígitos>`), assim "62991672674", "991672674" e "62 8419-7883" encontram o contato independentemente do 9 extra.
4. **Correção pontual de dados (SQL)**: desarquivar contatos que possuem troca real de mensagens (`ultima_msg_entrada_em` preenchido) e que estão marcados como arquivados — devolve à lista as conversas que sumiram indevidamente, inclusive a do MATHEUS TEIXEIRA e a sua de agora.

## Você precisa alterar algo?

Não. Nada muda no painel da Meta nem no seu WhatsApp — a correção é toda no sistema. Único ponto de comportamento: conversas arquivadas manualmente voltarão a aparecer automaticamente quando o cliente responder (que é o comportamento correto pedido).

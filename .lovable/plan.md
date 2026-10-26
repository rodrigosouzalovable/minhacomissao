# Mensagens "não disponibilizada pela Meta" no Inbox

## O que foi encontrado (últimos 3 dias, 67 casos)
- **38 casos**: o cliente respondeu ao pedido de permissão de ligação do WhatsApp ("Permitir ligações"). O sistema não reconhecia essa resposta.
- **2 casos**: o cliente apagou a mensagem para todos.
- **27 casos**: a própria Meta enviou só um aviso de "mensagem indisponível", sem o conteúdo (geralmente enquetes, mensagens de visualização única, mensagens de versões novas do WhatsApp ou mensagens que o cliente editou). Nesses casos o texto não chega ao sistema e não dá para recuperar.

Na lista de conversas aparece o mesmo aviso. A lista só mostra a última mensagem gravada, ela não tem o texto real.

## O que vai mudar
1. Resposta de permissão de ligação: mostrar "📞 Cliente permitiu ligações (permanente)" ou "📞 Cliente recusou ligações".
2. Mensagem apagada: mostrar "🚫 O cliente apagou esta mensagem".
3. Mensagens que a Meta não entrega: trocar por um aviso mais claro: "Conteúdo não enviado pela Meta (ex.: enquete, visualização única ou mensagem editada). Veja no celular do número."
4. Corrigir as 40 mensagens já gravadas dos itens 1 e 2, na conversa e na lista.

## Detalhes técnicos
- `meta-whatsapp-webhook/index.ts` `extractTextoFromMessage`: tratar `interactive.call_permission_reply` e `type=revoke`; trocar o texto do fallback `unsupported`/131060. Reimplantar.
- Atualizar `conteudo` em `meta_whatsapp_mensagens` com base em `payload_diagnostico` dos casos já salvos, e atualizar a última mensagem do contato quando for o caso.
- Sem novo cron, polling ou consulta pesada.

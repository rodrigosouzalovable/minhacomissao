# Mostrar contato compartilhado (vCard) no Inbox Meta

Hoje, quando o cliente compartilha um contato, o webhook da Meta grava apenas o texto `[contacts]` — o nome e o telefone que vieram no payload são descartados. Por isso a conversa mostra só "[contacts]".

## O que muda

1. **Captura no webhook** (`meta-whatsapp-webhook`): quando `type = contacts`, extrair de cada contato o nome (`name.formatted_name` ou primeiro+último nome) e os telefones (`phones[].phone` / `wa_id`), gravando um conteúdo estruturado com tipo `contato`.
2. **Exibição no chat** (`ChatMessage`): renderizar um cartão de contato no estilo WhatsApp Web — avatar/ícone, nome em destaque, telefone formatado `(62) 98419-7883`, e botões:
   - **Copiar número**
   - **Conversar** (abre/procura a conversa desse número no Inbox, se existir a instância; caso contrário, abre link `wa.me`).
   Vários contatos num único envio aparecem como "Nome e mais N contatos", expandindo a lista.
3. **Lista de conversas**: a prévia de última mensagem passa a mostrar `👤 Nome do contato` em vez de `[contacts]`.
4. **Mensagens antigas**: as já gravadas como `[contacts]` não têm mais os dados do payload; elas continuarão exibindo um cartão genérico "Contato compartilhado" (sem número). Só as novas trarão nome/telefone completos.

## Detalhes técnicos

- `extractTextoFromMessage` passa a retornar também um payload de contatos; grava-se em `meta_whatsapp_mensagens.conteudo` um texto legível (`👤 Nome — (62) 98419-7883`) e o JSON dos contatos em campo já existente adequado (`conteudo_citado` não serve) — será adicionada a coluna `contatos_payload jsonb` em `meta_whatsapp_mensagens` (nullable, sem impacto em RLS/grants existentes).
- `tipo_conteudo` = `contato`; `ChatMessage` ganha um bloco de render para esse tipo, com formatação de telefone BR reaproveitável.
- Nenhum novo cron, polling ou realtime: sem impacto de custo.

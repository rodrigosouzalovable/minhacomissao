## Problema

Ao enviar via **Envio Meta** para `5562981079590` (13 dígitos, com o "9" extra do celular), a mensagem é gravada com esse telefone. Quando o cliente responde pelo WhatsApp, a Meta entrega o webhook com o número **sem o 9** (`556281079590`, 12 dígitos — número legado). O webhook grava a resposta com esse telefone diferente, e o Inbox mostra duas conversas separadas para o mesmo contato.

Isso viola a regra do projeto de sempre casar telefones pelo **sufixo (últimos 8 dígitos)**.

## Correção

Somente em `supabase/functions/meta-whatsapp-webhook/index.ts`:

1. Ao processar cada mensagem (echo ou entrada), antes de inserir em `meta_whatsapp_mensagens` e antes de dar upsert em `meta_whatsapp_contatos`:
   - Extrair o sufixo dos últimos 8 dígitos do `outroLado`.
   - Buscar em `meta_whatsapp_contatos` (mesma `instancia_id`) um contato cujo `telefone` termine com esse sufixo (via `ilike '%<sufixo>'`).
   - Se encontrado, usar o `telefone` canônico existente como valor gravado tanto na mensagem quanto no upsert de contato — assim a resposta cai na conversa já criada pelo Envio Meta.
   - Se não encontrado, também procurar em `meta_whatsapp_envios_log` (por sufixo, mesma instância) para reaproveitar o telefone canônico do envio em massa mais recente.
   - Caso nada seja encontrado, gravar com o telefone recebido (comportamento atual).

2. Atualizar o `update` de `meta_whatsapp_envios_log` para `status='replied'` para casar por sufixo também (`telefone ilike '%<sufixo>'`) em vez de igualdade estrita, garantindo que a resposta marque o log correto quando os formatos diferem.

3. Não alterar `send-whatsapp-meta` nem o frontend — o telefone canônico continua sendo o que o Envio Meta grava (13 dígitos com "55" + DDD + 9).

## Sem migração / sem impacto no envio

- Nenhuma tabela é alterada.
- Envios continuam usando `formatTelefone` como hoje.
- Conversas antigas duplicadas não são mescladas automaticamente (evita risco). Se você quiser, posso adicionar depois um passo manual para consolidar as duplicadas já criadas.

## Verificação

- Enviar novo template para o mesmo número de teste e responder pelo WhatsApp: a resposta deve aparecer dentro da conversa existente, sem criar nova linha no Inbox.
- Logs do webhook devem mostrar o telefone canônico sendo reutilizado.
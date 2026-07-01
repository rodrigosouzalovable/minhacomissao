## Problema

Hoje, quando um template Meta é disparado pela aba "Envio Meta (Massa)", a mensagem enviada é gravada na conversa apenas como `[Template: nome_do_template]`. Isso já aparece no Inbox, mas fica genérico e sem o conteúdo real — parece que "só a resposta do cliente" aparece, quando na verdade a mensagem enviada está lá, só que ilegível.

## O que vou mudar

Na edge function `send-whatsapp-meta`, ao registrar a mensagem de saída no Inbox Meta:

1. Renderizar o **corpo real do template** (`body_text`) substituindo todas as variáveis (`{{1}}`, `{{nome}}`, `{{primeiro_nome}}`, `{{saldo}}`, etc.) com os dados do cliente, exatamente como o cliente recebe no WhatsApp.
2. Se o template tiver **header IMAGE**, gravar a mensagem como `tipo_conteudo: 'imagem'` e salvar a `media_url` (a imagem pública já usada no envio) — aí a imagem aparece dentro da conversa igual às outras mídias.
3. Manter o `template_nome` na coluna existente para rastreio, mas o `conteudo` passa a ser o texto renderizado (ex.: "Olá Rodrigo, seu débito de R$ 1.234,00…").
4. Também atualizar o `ultima_mensagem` do contato com esse texto renderizado, para o preview lateral ficar coerente.

## Onde

- `supabase/functions/send-whatsapp-meta/index.ts` — bloco que insere em `meta_whatsapp_mensagens` e faz upsert em `meta_whatsapp_contatos` (linhas ~250–300). Adiciono um helper `renderTemplateBody(template, cliente, parameters)` que reaproveita `resolveNamedVar` / `resolveVar` para preencher o corpo.

## Fora de escopo

- Renderizar retroativamente mensagens antigas já salvas como `[Template: …]` (ficam como estão).
- Botões do template no balão da conversa (só corpo + header image nesta entrega).
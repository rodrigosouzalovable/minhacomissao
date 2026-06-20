# Corrigir envio Meta — fallback de formato de parâmetro

## Problema
A Meta retornou `(#132012) Parameter format does not match format in the created template`.

O template `atualizacao` mostra `{{name}}` no preview, mas internamente foi criado com placeholder **posicional `{{1}}`**. A edge function está enviando como **nomeado** (`parameter_name: "name"`), e a Meta rejeita.

Você **não precisa alterar nada na Meta** — o ajuste é só na função de envio.

## O que será alterado

Arquivo: `supabase/functions/send-whatsapp-meta/index.ts`

1. **Tentar primeiro o formato detectado** (named se `{{xxx}}`, positional se `{{1}}`) — comportamento atual.
2. **Se a Meta responder erro `132012`**: refazer a chamada automaticamente usando o **outro formato** com o mesmo valor (primeiro nome do cliente).
3. **Persistir a preferência**: ao primeiro sucesso de um template, salvar em `meta_whatsapp_templates.variaveis` qual formato funcionou (ex.: `{"_format":"positional"}` ou `{"_format":"named","_param":"name"}`), para que envios futuros já comecem certos sem retry.

## Resultado esperado
Ao clicar em **Disparar**, o envio acontece (1 enviado, 0 erros). Próximos envios do mesmo template vão direto no formato correto, sem retry.

## Observação
Se quiser evitar essa lógica de fallback no futuro, você pode criar todos os novos templates na Meta usando explicitamente variáveis nomeadas (Body → "Add variable" → escolher nome). Mas não é obrigatório — o sistema vai funcionar com ambos.

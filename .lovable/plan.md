# Corrigir "Failed to send a request to the Edge Function" em Configurar Cloudflare

## Causa confirmada

A função de backend `site-cloudflare-config` (usada pelo diálogo "Configurar Cloudflare") não está publicada: chamá-la retorna `NOT_FOUND` 404. As outras funções de sites (publicar, excluir, consultar CNPJ) respondem normalmente, e a tabela `cloudflare_config` já existe. Por isso o diálogo mostra "Não configurado" e falha ao testar/salvar.

## O que vou fazer

1. Publicar a função `site-cloudflare-config` (é só o deploy; o código já está pronto).
2. Confirmar por teste direto que ela responde e valida token/Account ID.
3. Gravar as credenciais que você enviou (Account ID `84625013...0bfd` e o API Token) já validadas na Cloudflare, para você não precisar digitar de novo. O token fica guardado apenas no backend e nunca é exibido de volta.
4. Se a Cloudflare recusar o token, informo exatamente qual permissão está faltando em vez de deixar erro genérico.

## Observação de segurança

Você colou o API Token no chat. Depois de eu salvá-lo no sistema, o ideal é criar um token novo na Cloudflare e revogar esse — qualquer token compartilhado em texto deve ser considerado exposto. Posso te guiar nisso.

## Detalhes técnicos

- Deploy de `supabase/functions/site-cloudflare-config/index.ts` (sem alteração de código prevista).
- Validação via `GET /user/tokens/verify` e `GET /accounts/{id}` na API da Cloudflare; detecção automática do subdomínio `workers.dev`.
- Persistência em `public.cloudflare_config` (linha única, admin-only por RLS), já lida por `site-publicar`/`site-excluir` através de `_shared/cloudflareCreds.ts`.
- Nenhuma mudança no frontend, exceto ajuste de mensagem de erro se o teste indicar necessidade.

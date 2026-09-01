# Meus Sites: menu lateral + configuração da Cloudflare

## 1. Menu lateral sumindo

Causa confirmada: a página `src/pages/MeusSites.tsx` é a única das novas abas que não envolve seu conteúdo no componente de layout do sistema (as outras, como Blacklist e Calculadora UME, envolvem). Por isso a barra lateral não aparece nessa rota.

Correção: envolver o conteúdo da página com o layout padrão, igual às demais páginas. Nenhuma outra mudança visual.

## 2. Botão de configuração da Cloudflare

Adicionar um botão "Configurar Cloudflare" (ícone de engrenagem) no topo da aba, ao lado de "Criar site", abrindo um diálogo com:

- API Token da Cloudflare (campo protegido, mostra apenas se está configurado, nunca o valor)
- Account ID
- Zona/subdomínio de publicação (opcional, informativo)
- Botão "Testar conexão" que valida o token e lista se ele tem permissão de Workers
- Botão "Salvar"

Somente administradores podem abrir e salvar.

## Detalhes técnicos

- `src/pages/MeusSites.tsx`: envolver o retorno em `<AppLayout>`; adicionar botão + `CloudflareConfigDialog`.
- Novo componente `src/components/sites/CloudflareConfigDialog.tsx`.
- Nova Edge Function `site-cloudflare-config`:
  - `GET/status`: retorna se token e account id estão presentes e o resultado da última validação (nunca retorna o token).
  - `POST/salvar`: valida o token em `https://api.cloudflare.com/client/v4/user/tokens/verify` e confere o Account ID em `/accounts`; só grava se válido.
  - `POST/testar`: apenas valida e devolve o diagnóstico.
  - Autorização: exige JWT e checa `has_role(uid,'admin')`.
- Armazenamento: os valores ficam nos segredos do backend (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) já usados por `site-publicar`. Como segredos não podem ser gravados por código, o diálogo grava numa tabela nova `cloudflare_config` (admin-only por RLS, uma única linha), e `site-publicar`/`site-excluir` passam a ler primeiro dessa tabela e usar o segredo apenas como fallback. Assim você atualiza tudo pela interface, sem depender de mim.
- Migração: criar `public.cloudflare_config` com `api_token`, `account_id`, `validado_em`, `criado_em`, `atualizado_em`; GRANTs para `authenticated`/`service_role`; RLS liberando somente admins; nenhuma leitura pública.
- Ajuste em `supabase/functions/site-publicar/index.ts` e `site-excluir/index.ts` para buscar credenciais via helper compartilhado.

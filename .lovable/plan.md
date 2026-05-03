# Plano: Proxy SOCKS5 nas instâncias UAZAPI

## Status atual
**Não há nada de proxy implementado** no projeto hoje (busquei em todo o código — frontend, edge functions, banco — zero referências). Vamos construir do zero.

## O que será entregue

1. **Banco**: novas colunas em `user_whatsapp_instances` para guardar credenciais de proxy.
2. **Edge function** que aplica o proxy na UAZAPI por instância.
3. **UI nova** dentro de **Aquecimento → aba "Proxies"** (ou Configurações WhatsApp) com:
   - Formulário individual por instância (host, porta, user, senha, ativar/desativar).
   - **Botão "Aplicar proxy em massa"** com seleção de instâncias (todas / selecionar / só ativas).
   - Indicador de status (proxy aplicado ✅ / pendente ⚠️ / erro ❌).
4. **Aplicação automática em novas conexões**: ao criar instância via QR, se houver "proxy padrão" salvo, aplica antes de gerar QR.

## Detalhes técnicos

### 1) Migration (schema)
Adicionar em `user_whatsapp_instances`:
```text
proxy_enabled       boolean default false
proxy_type          text default 'socks5'  -- 'socks5' | 'http'
proxy_host          text
proxy_port          integer
proxy_username      text
proxy_password      text
proxy_aplicado_em   timestamptz
proxy_ultimo_erro   text
```
RLS: já existe na tabela (owner). Sem mudança de policy.

### 2) Edge function `uazapi-set-proxy`
- Input: `{ instance_id }` ou `{ server_url, instance_token, proxy: {...} }`.
- Fluxo:
  1. Lê linha da instância (se receber `instance_id`).
  2. Chama UAZAPI: `POST {server_url}/instance/updateProxy` com headers `token` + body `{ enabled, type, host, port, username, password }`. (UAZAPI suporta SOCKS5 nativamente.)
  3. Em sucesso, atualiza `proxy_aplicado_em = now()`, limpa `proxy_ultimo_erro`.
  4. Em erro, grava `proxy_ultimo_erro` e retorna 200 com `fallback:true` (segue regra global de erros UAZAPI).
- Modo lote: aceitar `{ instance_ids: [...] }` e processar com **delay 1–3s entre chamadas** (anti-rate-limit), retornando relatório `{ ok, falhas }`.

### 3) UI — nova aba "Proxies" em `/aquecimento`
Componente `ProxiesTab.tsx`:
- Tabela das 103 instâncias com colunas: Nome | Host | Porta | User | Status | Ações.
- Edição inline (click → input).
- Botão "Aplicar agora" por linha → chama `uazapi-set-proxy`.
- **Toolbar superior**:
  - Checkbox "Selecionar todas".
  - Inputs para "Aplicar mesmo proxy em todas selecionadas" (cola host:porta:user:senha de uma vez).
  - Botão "Aplicar em massa" → mostra progress bar (X/103).
- Toggle global: "Aplicar proxy automaticamente em novas instâncias".

### 4) Integração com criação de instância
Em `supabase/functions/whatsapp-qr/index.ts`, após `instance/init` e antes do `instance/connect`:
- Se houver proxy padrão configurado (lido de uma nova tabela `system_settings` chave `default_proxy`) **e** o toggle global estiver ligado, chama `updateProxy` antes do connect.

### 5) Segurança
- Senha de proxy fica no banco (não há como evitar — UAZAPI exige), protegida por RLS de owner.
- Mascarar senha na UI (`••••`) com botão "mostrar".
- Não logar `proxy_password` em edge function.

## Arquivos a criar/alterar
```text
NOVO  supabase/functions/uazapi-set-proxy/index.ts
NOVO  src/components/aquecimento/ProxiesTab.tsx
EDIT  src/pages/Aquecimento.tsx                  (adicionar nova tab)
EDIT  supabase/functions/whatsapp-qr/index.ts    (aplicar proxy padrão em novas)
MIG   ALTER TABLE user_whatsapp_instances ADD COLUMN proxy_*
MIG   CREATE TABLE system_settings (key text PK, value jsonb)  -- p/ proxy padrão
```

## Custo Lovable Cloud
- **Aplicação inicial nas 103**: ~103 invocações **uma vez** (≈ $0.01).
- **Recorrente**: zero — só roda quando você pedir.
- Sem cron novo, sem polling. **Impacto desprezível.**

## Ordem de execução
1. Migration (schema + tabela settings).
2. Edge function `uazapi-set-proxy` (modo single + lote).
3. UI `ProxiesTab` integrada em Aquecimento.
4. Hook em `whatsapp-qr` para novas conexões.
5. Você cola um proxy de teste em 1 instância → valida → aplica em massa.

Aprovar para eu executar?

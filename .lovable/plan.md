# Tornar o MEUS ACORDOS um parceiro oficial da Meta (Solution Partner)

Objetivo: permitir que o MEUS ACORDOS cadastre empresas-cliente, provisione e gerencie ativos de WhatsApp Business (BM, WABA, números) em nome delas usando o App ID `1081283281394312`, começando pelo onboarding.

## O que precisa acontecer no lado da Meta (você faz fora do sistema)

1. **Verificação comercial**: o app `1081283281394312` e a BM dona dele devem estar verificados (Business Verification concluída) e ter o WhatsApp Business API ativo.
2. **Criar a "Solução de Parceiro"**: no painel do app, em "Soluções de Parceiro", criar a solução usando o App ID. Isso gera o fluxo de embedded signup para clientes compartilharem WABA/números.
3. **Permissões mínimas do app**: garantir que o app tenha as permissões `whatsapp_business_management`, `whatsapp_business_messaging` e `business_management` aprovadas.
4. **Token de acesso do parceiro**: gerar e guardar um token de longa duração (System User Token da BM dona do app) para fazer chamadas em nome dos clientes.
5. **Webhook**: o webhook único do sistema (`meta-whatsapp-webhook`) continua sendo usado; a diferença é que as instâncias passam a pertencer a clientes, não mais diretamente a usuários internos.

## O que vamos construir no sistema

### 1. Banco de dados

Nova migração com:

- `meta_partner_clients`: representa cada empresa-cliente do parceiro.
  - `id` uuid PK, `nome` text not null, `documento` text (CNPJ/CPF), `responsavel_nome`, `responsavel_email`, `responsavel_telefone`, `ativo` boolean default true, `criado_em`.
  - GRANTs padrão (`authenticated` SELECT/INSERT/UPDATE/DELETE, `service_role` ALL), RLS ativo.
  - Políticas: admin vê e gerencia tudo; usuário comum vê apenas clientes vinculados a ele (tabela de vínculo abaixo).
- `meta_partner_client_users`: vínculo usuário ↔ cliente (muitos-para-muitos).
  - `cliente_id`, `user_id`, `papel` (admin_cliente / operador), `criado_em`.
  - PK composta (`cliente_id`, `user_id`).
- Alterar `meta_business_managers`:
  - Adicionar `partner_client_id` uuid nullable FK para `meta_partner_clients`.
- Alterar `meta_whatsapp_instances`:
  - Adicionar `partner_client_id` uuid nullable FK para `meta_partner_clients`.
  - Manter `user_id` (quem provisionou/cadastrou internamente) e adicionar a relação com o cliente.
- Políticas de RLS atualizadas:
  - `meta_whatsapp_instances`: admin vê tudo; parceiro/cliente vê apenas instâncias do próprio `partner_client_id`; regra atual de `parceiro_meta` continua valendo.
  - `meta_business_managers`: mesma lógica por `partner_client_id`.
  - `meta_whatsapp_templates`, `meta_whatsapp_envios_log`, `meta_whatsapp_mensagens`: propagar a visibilidade pela instância (`partner_client_id`).

### 2. Backend (Edge Functions)

- `meta-partner-onboarding`:
  - Recebe o código de embedded signup da Meta (`code` trocado por access token de curta duração do cliente).
  - Com o token do cliente, lista BMs, WABAs e números de telefone disponíveis.
  - Cria/atualiza registros em `meta_business_managers` e `meta_whatsapp_instances` vinculados ao `partner_client_id`.
  - Armazena o access token do cliente de forma segura (usando secret store ou criptografia no banco; preferencialmente não salvar em texto plano).
- `meta-partner-listar-ativos`:
  - Lista WABAs e números já compartilhados com o app parceiro, usando o token do cliente.
- `meta-partner-refresh-token`:
  - Rotina para renovar tokens de longa duração dos clientes (Meta exige refresh a cada ~60 dias).
- Ajuste em `meta-whatsapp-webhook`:
  - Ao receber mensagens/statuses, garantir que a instância seja identificável mesmo quando pertencer a um cliente (já funciona por `phone_number_id`, mas confirmar que a política de RLS não bloqueia leitura do service_role).

### 3. Frontend

- Nova página/aba "Parceiros" dentro de `ConfigurarMeta.tsx` (visível só para admin):
  - Lista de clientes (`meta_partner_clients`) com busca.
  - Botão "Novo cliente": modal com nome, documento, responsável, e-mail, telefone.
  - Botão "Conectar Meta" por cliente: abre o fluxo de embedded signup da Meta (redireciona para `https://business.facebook.com/whatsapp/business/setup/` com o App ID e callback para o sistema).
  - Após autorização, exibe os ativos descobertos (BM, WABA, números) e permite selecionar quais importar para o sistema.
- Ajuste em `ConfigurarMeta.tsx`:
  - Coluna "Cliente" nas tabelas de BM e Instâncias.
  - Filtro por cliente.
- Ajuste em `EnvioMeta.tsx` e `InboxMeta.tsx`:
  - Usuários vinculados a um cliente só veem instâncias daquele cliente.
  - Admin continua vendo tudo.

### 4. Segurança e isolamento

- Tokens de acesso dos clientes nunca aparecem no frontend.
- Cada usuário cliente só acessa dados do próprio `partner_client_id`.
- Admin do MEUS ACORDOS vê e gerencia todos os clientes.
- Logs de envio e mensagens herdam o isolamento pela instância.

### 5. Testes e validação

- Testar embedded signup com uma BM de teste.
- Verificar se instâncias importadas recebem webhooks e enviam mensagens.
- Validar RLS: usuário cliente não enxerga instâncias de outro cliente.
- Validar refresh de token antes do vencimento.

## Fora de escopo desta primeira entrega

- Cobrança automática por uso (faturamento do parceiro).
- Painel white-label para clientes finais.
- Multi-tenant completo de usuários internos dos clientes (apenas vínculo básico usuário ↔ cliente).
- Assinatura de contrato digital dentro do sistema.

## Próximos passos

1. Você confirma se o app `1081283281394312` já tem Business Verification e as permissões do WhatsApp aprovadas.
2. Assim que confirmar, implementamos a migração, as edge functions e a tela de onboarding.

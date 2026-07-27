## Objetivo

Criar "caixas de mensagens" (folders) personalizadas no **Inbox Meta Oficial**, além do modo padrão atual. Cada campanha do **Envio Meta** poderá ser roteada para uma caixa específica; as conversas geradas por essa campanha só aparecerão para os usuários autorizados naquela caixa — sem misturar com a caixa padrão da equipe.

## Como vai funcionar (fluxo do usuário)

1. No Inbox Meta, abaixo dos filtros `Conversas / Arquivados / Todas / Não lidas`, aparece um botão **`+`** que abre um popover com:
   - Lista de caixas existentes (Padrão + customizadas visíveis para o usuário)
   - Ação **"Nova caixa"** (nome + cor)
   - Ícone de **engrenagem** em cada caixa customizada → dialog para editar nome, cor, excluir, e **selecionar usuários com acesso**
2. Selecionar uma caixa filtra a lista de conversas para mostrar apenas as dessa caixa. A caixa "Padrão" mostra tudo que **não** foi roteado para uma caixa customizada (comportamento idêntico ao de hoje).
3. Em **Envio Meta**, ao criar uma campanha aparece um seletor **"Caixa de mensagens"** com opções: `Padrão` (default) ou qualquer caixa customizada criada pelo admin. Todo contato/conversa gerado por essa campanha fica marcado com a caixa escolhida.
4. Respostas do cliente entram automaticamente na mesma caixa em que a conversa foi aberta (o contato já está marcado). Só usuários com acesso àquela caixa veem a conversa; admin vê tudo.

## Alterações de banco

Nova tabela `meta_inbox_folders`:
- `nome`, `cor`, `owner_id` (admin criador), timestamps
- RLS: admin vê tudo; usuário vê caixas onde é owner ou está em `meta_inbox_folder_members`

Nova tabela `meta_inbox_folder_members`:
- `folder_id`, `user_id`, unique(folder_id, user_id)
- RLS: admin/owner gerenciam; usuário vê a própria linha

Coluna nova em `meta_whatsapp_contatos`: `folder_id uuid null` (null = caixa Padrão).

Coluna nova em `meta_campanha_agendada`: `folder_id uuid null` (roteamento do disparo).

RLS de `meta_whatsapp_contatos` e `meta_whatsapp_mensagens` ampliadas para: admin sempre vê; se `folder_id` for null → mantém regra atual (equipe); se `folder_id` não-null → apenas owner do folder ou membro de `meta_inbox_folder_members` vê.

## Alterações no backend de envio

`envio-meta-massa-iniciar` passa a ler `folder_id` da campanha e propaga para:
- `envio_meta_job` (nova coluna `folder_id`) e `envio_meta_job_item`
- Ao criar/atualizar o `meta_whatsapp_contatos` no `send-whatsapp-meta` / `send-whatsapp-meta-media` / `send-whatsapp-meta-text`, grava `folder_id` do job (se existir). Se o contato já existir com folder diferente, mantém o folder original (não sobrescreve — evita que uma nova campanha "roube" o contato de outra caixa).
- Webhook de entrada (`meta-whatsapp-webhook`) não muda: o `folder_id` está no contato, então mensagens de resposta já herdam via join.

Nenhuma mudança na Meta API, formato de payload, delay, AIMD, rate-limit ou modo rajada — o folder é apenas um "carimbo" local.

## Alterações de UI

`src/pages/InboxMeta.tsx`:
- Botão `+` (Popover) abaixo da linha `Todas / Não lidas` mostrando lista de caixas + "Nova caixa"
- Estado `folderId | 'padrao'` filtra a query de conversas por `folder_id`
- Header do inbox mostra o nome/cor da caixa ativa quando não é a Padrão

Novo `src/components/inbox/meta/GerenciarCaixaDialog.tsx`:
- Editar nome/cor, excluir caixa (conversas voltam para Padrão), lista de usuários com switch de acesso (busca em `profiles`)

`src/pages/EnvioMeta.tsx`:
- Novo select "Caixa de mensagens" ao lado da seleção de instâncias/template, opções carregadas do folder list do admin
- Persistido em `meta_campanha_agendada.folder_id`

## Regras e proteções

- Apenas **admin** pode criar/editar/excluir caixas e escolher membros
- Apenas **admin** pode selecionar caixa no Envio Meta; para outros usuários o campo não aparece (envio sai como Padrão)
- Excluir caixa faz `UPDATE meta_whatsapp_contatos SET folder_id = null` para não perder conversas
- Admin (`has_role(auth.uid(),'admin')`) sempre enxerga qualquer caixa e conversa, inclusive as customizadas
- Nenhuma mudança em RLS/policies do bucket de storage ou em edge functions de auth — apenas leitura filtrada

## Detalhes técnicos

- Filtro no Inbox: `.eq('folder_id', folderId)` ou `.is('folder_id', null)` para Padrão
- Realtime existente continua funcionando (o filtro é client-side sobre o mesmo canal)
- Índices: `meta_whatsapp_contatos(folder_id)`, `meta_campanha_agendada(folder_id)`, `meta_inbox_folder_members(user_id)`
- Grants padrão para `authenticated` e `service_role` em ambas as tabelas novas
- Migration em uma única aplicação, contendo CREATE TABLE + GRANT + RLS + POLICY na ordem correta

## Fora de escopo

- Mover conversas antigas entre caixas em massa (fica para depois se você pedir)
- Ícones custom por caixa além de cor
- Notificações separadas por caixa

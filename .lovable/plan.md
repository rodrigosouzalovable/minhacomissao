# Atendentes do Inbox Meta: toggle em Permissões + fim da etiqueta errada

## Por que a conversa é etiquetada com outro atendente (confirmado no código)

No webhook do Inbox Meta, quando o cliente responde, o sistema tenta identificar o atendente nesta ordem:

1. Acordo lançado com o mesmo telefone (últimos 8 dígitos)
2. Consulta de CPF no portal nos últimos 7 dias
3. **Rodízio por menor carga** — se as duas primeiras falharem, o sistema simplesmente escolhe o atendente com menos conversas, sem nenhuma relação com quem iniciou a conversa.

É o passo 3 que causa o relato dos funcionários: o atendente abre a conversa pelo "Nova conversa", o cliente responde, não existe acordo nem consulta daquele telefone, e a etiqueta vai para outra pessoa. Hoje o rodízio só exclui um nome fixo escrito no código ("Atendente: Thailinny Nolasco"), sem controle na tela.

Também está confirmado que cada mensagem enviada guarda o usuário que enviou (`user_id` real de quem disparou), então é possível saber quem iniciou a conversa.

## O que será feito

### 1. Novo campo em Permissões (aba Usuários)

- Toggle **"Atende no Inbox Meta Oficial"** no diálogo de permissões de cada usuário.
- Ativo: o usuário pode receber a etiqueta de atendente das conversas do Inbox Meta.
- Desativado: nunca recebe etiqueta automática (nem por conversa iniciada, nem por rodízio) — é o caso do Rodrigo Ribeiro de Souza.
- Substitui a exclusão fixa escrita no código pela regra configurável na tela.
- Para não mudar o comportamento de ninguém de surpresa, os atendentes hoje elegíveis (todos menos Thailinny) já entram com o toggle ativado.

### 2. Etiqueta segue quem realmente iniciou a conversa

Nova ordem de decisão no webhook:

1. Acordo com o mesmo telefone (como hoje)
2. Consulta de CPF no portal nos últimos 7 dias (como hoje)
3. **Quem enviou a última mensagem para aquele contato** (novo passo) — se esse usuário estiver com o toggle ativo, a etiqueta é dele
4. Rodízio por menor carga, **apenas entre usuários com o toggle ativo**

Disparos em massa/campanha continuam caindo no rodízio quando o remetente estiver com o toggle desativado, então uma campanha enviada pelo login do admin não vai mais etiquetar conversas no nome dele.

Se ninguém estiver elegível, a conversa fica sem etiqueta de atendente (nada é atribuído "no chute").

A regra de exclusividade já existente é mantida: uma conversa tem no máximo uma etiqueta de atendente.

## Detalhes técnicos

- Banco: coluna `atende_inbox_meta boolean not null default true` em `user_permissions`; backfill `false` para o usuário correspondente a "Thailinny Nolasco".
- `src/components/EditPermissionsDialog.tsx`: novo Switch lido/gravado junto com as demais permissões.
- `src/hooks/useUserPermissions.tsx`: expõe `atendeInboxMeta`.
- `supabase/functions/meta-whatsapp-webhook/index.ts`: monta a lista de etiquetas elegíveis cruzando `meta_whatsapp_etiquetas` (prefixo "Atendente:") com `profiles.nome` e `user_permissions.atende_inbox_meta = true`; adiciona o passo 3 consultando a última mensagem `direcao='saida'` do contato (`meta_whatsapp_mensagens.user_id`); remove o filtro fixo pelo nome.

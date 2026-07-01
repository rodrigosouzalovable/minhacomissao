## Objetivo
1. Liberar acesso completo ao **Inbox Meta Oficial** (mesma visão do admin) para 4 atendentes.
2. Criar uma **fila de atendimento circular** entre esses 4 usuários: quando um cliente responder, a conversa é automaticamente etiquetada com o nome do próximo atendente da fila.

## Usuários da fila (nessa ordem)
1. Anna Flavia Leite de Morais
2. Yasmim Batista Sousa Silva
3. Fernanda Estock de Oliveira Barros
4. Wallace Maciel

Os 4 já têm `/admin/inbox-meta` nas abas permitidas e `inbox_compartilhado=true`. Falta apenas a RLS liberar leitura das linhas do admin.

## 1. Liberar visualização compartilhada (RLS)

As tabelas `meta_whatsapp_contatos`, `meta_whatsapp_mensagens` e `meta_whatsapp_instances` hoje só permitem `auth.uid() = user_id OR is_admin_user()`. Vamos ampliar as policies para incluir quem tem `inbox_compartilhado=true` (função `has_inbox_compartilhado` já existe):

- `meta_whatsapp_contatos`: SELECT/UPDATE liberado para `has_inbox_compartilhado(auth.uid())`.
- `meta_whatsapp_mensagens`: SELECT/INSERT liberado para `has_inbox_compartilhado(auth.uid())` (permite responder pela conta do dono da instância).
- `meta_whatsapp_instances`: SELECT liberado para `has_inbox_compartilhado(auth.uid())` (para o filtro de instâncias funcionar).
- `meta_whatsapp_etiquetas` e `meta_whatsapp_contato_etiquetas`: SELECT liberado para `has_inbox_compartilhado(auth.uid())` (para visualizar as etiquetas da fila criadas pelo admin).

O envio de mensagens continua ocorrendo via edge function `send-whatsapp-meta-*`, que usa a instância dona (admin) — sem mudança nesse fluxo.

## 2. Fila de atendimento automática

### Estrutura de dados
Nova tabela **`meta_atendimento_fila`**:
- `user_id` (uuid, FK profiles) — atendente
- `ordem` (int) — posição na fila (1..N)
- `ativo` (bool)

Nova tabela **`meta_atendimento_estado`** (singleton):
- `id` (int, sempre 1)
- `ultimo_index` (int) — última posição usada no round-robin

Seed: inserir os 4 usuários acima nas ordens 1–4.

### Etiquetas de atendente
Ao rodar a migração, criar (uma vez) 4 etiquetas em `meta_whatsapp_etiquetas` pertencentes ao admin, com nome `Atendente: <Primeiro Nome>` e uma cor distinta por atendente. Guardar o `etiqueta_id` de cada atendente em `meta_atendimento_fila.etiqueta_id`.

### Trigger de atribuição
Trigger `AFTER INSERT` em `meta_whatsapp_mensagens` que dispara função `atribuir_atendente_fila()`:

1. Só age quando `direcao='entrada'` (resposta do cliente).
2. Localiza o `contato_id` correspondente (via `instancia_id` + `telefone`).
3. Se o contato **já tem** alguma etiqueta da fila em `meta_whatsapp_contato_etiquetas`, **não faz nada** (mantém o atendente original — evita trocar de atendente a cada nova resposta).
4. Caso contrário: pega o próximo `ordem` da fila (round-robin usando `ultimo_index`), incrementa o estado, e insere um registro em `meta_whatsapp_contato_etiquetas` ligando o contato à etiqueta do atendente.

Assim, a primeira resposta de cada novo cliente rotaciona pela fila e "fica" com o atendente atribuído em todas as respostas seguintes.

### UI (mínima)
Nenhuma tela nova nesta entrega — as etiquetas já aparecem no card de cada conversa no `InboxMeta.tsx`, então o nome do atendente responsável fica visível automaticamente ao lado da conversa.

## Detalhes técnicos

- Migração cria tabelas + GRANTs + RLS (SELECT para authenticated com `inbox_compartilhado` ou admin; escrita só pelo `service_role`/admin).
- Função e trigger com `SECURITY DEFINER` e `search_path = public`.
- Round-robin usa `UPDATE ... RETURNING` em transação para evitar corrida.
- Seed dos 4 usuários e das 4 etiquetas roda condicional (`ON CONFLICT DO NOTHING`).

## Fora do escopo
- Reatribuição manual pelo admin (trocar de atendente em uma conversa) — pode ser adicionado depois usando o menu de etiquetas já existente.
- Balanceamento por carga (hoje é round-robin puro, não considera quantas conversas cada atendente tem em aberto).

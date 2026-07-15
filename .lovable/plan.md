
## Diagnóstico

Confirmei o problema direto no banco:

- O contato **Matheus Teixeira (55 62 8419-7883)** existe, **não está arquivado**, e teve última troca em **14/07/2026** (mensagem de entrada e de saída no mesmo dia). Ou seja: é uma conversa real com troca dos dois lados, deveria estar visível.
- A tabela `meta_whatsapp_contatos` tem hoje **5.485 contatos não arquivados**, mas o Inbox Meta faz `SELECT ... ORDER BY ultima_mensagem_em DESC LIMIT 500` (arquivo `src/pages/InboxMeta.tsx`, função `fetchContatos`).
- A busca do Inbox filtra apenas em cima da lista já carregada em memória. Então qualquer conversa mais antiga que as 500 mais recentes some da tela e também não é encontrada quando você digita o nome/telefone — foi exatamente o que aconteceu com o Matheus.

Não existe hoje nenhuma rotina que apague/arquive contatos Meta automaticamente. O sumiço é 100% por causa desse `LIMIT 500` do lado do cliente.

## O que vou fazer

### 1) Fim do "some depois de X conversas" no Inbox Meta

Ajustar `fetchContatos` em `src/pages/InboxMeta.tsx` para:

- **Buscar do servidor quando o usuário pesquisa.** Enquanto a busca (`busca`) tiver texto, disparar uma query paralela no Supabase usando `.or('nome.ilike.%X%,telefone.ilike.%digits%')` (respeitando `arquivado` e `filtroInstancia`), com um `LIMIT` maior (ex.: 200 resultados). O resultado é mesclado com a lista já carregada, deduplicando por `id`. Assim, mesmo que o contato não esteja nas 500 mais recentes, ele aparece assim que você digita "Matheus" ou "8419".
- **Aumentar o teto da lista padrão** de 500 para 2000 contatos não arquivados (usa o índice `idx_meta_wa_contatos_arq_ult` que já existe, custo desprezível).
- Debounce de ~250ms na busca para não martelar o banco a cada tecla.

Isso resolve o sintoma imediato (Matheus e todas as conversas antigas voltam a aparecer na pesquisa) sem mexer em nenhum dado.

### 2) Política de retenção conforme sua regra

Criar edge function nova `meta-inbox-retention` + cron diário (03:00 BRT). Regra:

- **Nunca toca em conversa que teve mensagem de entrada** (`ultima_msg_entrada_em IS NOT NULL`). Essas ficam pra sempre.
- **Nunca toca em conversa fixada** (`fixado = true`), com etiquetas aplicadas, ou com mensagens não lidas.
- Só **arquiva** (não apaga — `arquivado = true`) conversas onde: `ultima_msg_entrada_em IS NULL` **E** `ultima_mensagem_em < now() - 3 dias`. Ou seja: aberta por nós, cliente nunca respondeu, mais de 3 dias.
- Arquivar (não deletar) preserva o histórico — se um dia o cliente responder, o webhook `meta-whatsapp-webhook` já sabe reabrir/atualizar o contato e ele volta pra aba principal.

Adicionar cron via migration (`supabase/migrations/...retention.sql`) chamando a function 1x/dia. Volume esperado é baixo, custo desprezível (respeita a memória "Cloud Cost Awareness").

### 3) Sem migração destrutiva

Não vou apagar nem alterar nenhum registro existente. O Matheus (e qualquer outra conversa antiga) volta a aparecer só com o fix do item 1.

## Arquivos afetados

- editar `src/pages/InboxMeta.tsx` (query server-side na busca + limite 2000 + debounce)
- criar `supabase/functions/meta-inbox-retention/index.ts`
- criar migration com o cron job
- editar `supabase/config.toml` para registrar a nova function

## Fora de escopo

- Não vou mexer no Inbox UAZAPI (`WhatsAppInbox.tsx`), só no Meta oficial.
- Não vou apagar mensagens antigas do `meta_whatsapp_mensagens` — a limpeza de mídia expirada já é feita por `cleanup-inbox-media` e continua como está.

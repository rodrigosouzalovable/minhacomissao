
## Diagnóstico (confirmado no banco)

A resposta "Parcelamento" da Darlene *existe* em `meta_whatsapp_mensagens` (id `5006eea2…`, 28/07 16:24). Ela só não aparece na conversa aberta porque **existem dois contatos duplicados na mesma instância**, com o telefone gravado em formatos diferentes:

- `Darlene Tavares` → `556195909521` (12 dígitos, sem o 9)
- `DARLENE TAVARES SOARES DE MENEZES` → `5561995909521` (13 dígitos, com 9)

As mensagens ficaram intercaladas entre os dois telefones (algumas enviadas para um formato, outras recebidas no outro). O Inbox filtra mensagens por `telefone = contato.telefone` exato, então cada card mostra só metade da conversa e "some" o resto.

A canonicalização por sufixo (últimos 8 dígitos) já existe no `meta-whatsapp-webhook`, mas ela só age se **já existir** um `meta_whatsapp_contatos` com telefone diferente no mesmo sufixo *no momento em que a mensagem chega*. Como a primeira entrada da Darlene chegou antes de qualquer contato/envio salvo naquele formato, o número entrou como 12 dígitos e depois os envios criaram um segundo contato com 13 dígitos — e o fluxo de envio (`send-whatsapp-meta`) não faz canonicalização nenhuma.

Esse mesmo padrão pode estar afetando outras conversas silenciosamente. É isso que precisamos resolver.

## O que fazer

### 1. Migração de dados: mesclar contatos duplicados por sufixo

Para cada `(instancia_id, últimos 8 dígitos do telefone)` com mais de um `meta_whatsapp_contatos`:
- Escolher como **canônico** o contato que tem `ultima_msg_entrada_em` mais recente (ou o mais antigo, se nenhum tiver entrada).
- Reapontar para o telefone canônico: `meta_whatsapp_mensagens`, `meta_whatsapp_envios_log`, `meta_whatsapp_contato_etiquetas` (via `contato_id`), campanhas e demais tabelas que referenciam `telefone` na mesma instância.
- Copiar para o canônico: `nome` (se estiver vazio), `folder_id`, `nao_lido` (soma), `ultima_msg_entrada_em` (max), `arquivado` (OR).
- Deletar os contatos duplicados não-canônicos.

### 2. Canonicalização no ponto de escrita (para nunca mais duplicar)

- **`send-whatsapp-meta` / `send-whatsapp-meta-text` / `send-whatsapp-meta-media`**: antes de inserir em `meta_whatsapp_mensagens` e antes de fazer upsert em `meta_whatsapp_contatos`, buscar contato existente pelo sufixo (`instancia_id` + últimos 8 dígitos) e usar o `telefone` já cadastrado. Se não existir, manter o formato Meta.
- **`meta-whatsapp-webhook`**: ampliar a canonicalização atual para também considerar mensagens já gravadas em `meta_whatsapp_mensagens` (não só `contatos`/`envios_log`), fechando a corrida da "primeira mensagem".

### 3. Camada de defesa no front (Inbox Meta)

Em `src/pages/InboxMeta.tsx`, ao carregar e escutar mensagens de um contato, filtrar por **sufixo de 8 dígitos** do telefone em vez de igualdade exata:
- Trocar `.eq('telefone', contato.telefone)` por `.ilike('telefone', %<sufixo>)` (com o sufixo já normalizado sem não-dígitos).
- Ajustar o filtro do Realtime da mesma forma (comparar `row.telefone` pelo sufixo).

Isso garante que, mesmo se um duplicado voltar a aparecer no futuro, a conversa continua unificada visualmente.

### 4. Validação

- Confirmar no banco que a Darlene passou a ter um único `meta_whatsapp_contatos` com todas as mensagens (incluindo "Parcelamento" de 16:24).
- Abrir a conversa no Inbox e verificar que aparece o histórico completo em ordem.
- Rodar uma query genérica para confirmar que não há mais pares duplicados por sufixo em nenhuma instância.

## Fora do escopo

- Não vamos mexer no comportamento de arquivamento/retenção nem em templates.
- Não vamos alterar a estrutura das tabelas (só dados + código).

## Consolidar Wallace + parar criação automática + botão "Criar Etiqueta"

### 1. Consolidar etiqueta duplicada do Wallace (SQL de dados)
Mesmo dono das duas etiquetas (`ee649720…`), então basta remapear e apagar:
- Repontar todos os vínculos em `meta_whatsapp_contato_etiquetas` de `Atendente: Wallace` (`c086cd6d…`) para `Atendente: Wallace Maciel` (`151276d0…`), tratando o UNIQUE (contato_id, etiqueta_id) — remove vínculo curto quando já existir o canônico, senão faz UPDATE.
- Apagar a etiqueta `Atendente: Wallace`.

### 2. Impedir que o sistema crie etiquetas sozinho
Hoje duas Edge Functions criam etiqueta `Atendente: <nome>` na hora se não existir. Passar as duas para modo "apenas aplicar se já existir":

- `supabase/functions/send-whatsapp-meta/index.ts` (linhas ~511-559): remover o bloco de `insert` em `meta_whatsapp_etiquetas`. Se a etiqueta canônica não existir, apenas logar e seguir sem aplicar.
- `supabase/functions/meta-whatsapp-webhook/index.ts` (linhas ~521-549): idem — buscar a etiqueta existente do atendente; se não achar, não criar, só ignorar.

Resultado: só usuários criam etiquetas pelo diálogo/dropdown. As etiquetas já existentes continuam sendo aplicadas automaticamente às conversas correspondentes.

### 3. Botão "Criar Etiqueta" no dropdown do filtro
Em `src/pages/InboxMeta.tsx`, dentro do `PopoverContent` do filtro de etiquetas (linha ~753-804), adicionar, logo abaixo do último item da lista, um botão full-width `+ Criar Etiqueta` que:
- fecha o popover (`setFiltroEtOpen(false)`)
- abre o diálogo já existente `MetaEtiquetasDialog` (`setEtiquetasOpen(true)`) — que já permite qualquer usuário criar etiquetas com nome + cor.

Nenhuma migração de schema. Sem mudanças nas regras de RLS.

## Escopo

Três correções na página de Envio em massa — Meta WhatsApp:

1. Campanhas não podem sumir ao serem canceladas — só somem se o usuário clicar em "Excluir".
2. No Inbox, a mensagem enviada precisa mostrar imagem + texto + botões (hoje só aparece a imagem).
3. Ao importar planilha, quando o template usa `{{1}}` `{{2}}` (mesmo sem body_text populado), esses campos precisam aparecer no seletor de mapeamento de colunas.

---

## 1) Botão flutuante "Campanhas" — persistir tudo + botão Excluir

Arquivo: `src/components/meta/CampanhasFlutuante.tsx`

- Remover o `.slice(0, 5)` de `finalizadasRecentes`. Mostrar todas as campanhas finalizadas (concluído / cancelado / erro) que ainda estão no `jobs` array (o context já carrega as 30 mais recentes).
- Trocar o layout dos itens finalizados de `<button>` para um `div` com o mesmo conteúdo clicável (abre detalhes) + um ícone `Trash2` à direita.
- O botão Excluir chama `limparJob(job.id)` com `confirm()` de segurança. `limparJob` já bloqueia se o job estiver `rodando/pausado`, então só aparece para finalizados.
- Adicionar contador "Últimas finalizadas (N)" para deixar claro que a lista está completa.
- Nenhuma alteração em `EnvioMetaSendingContext` — `cancelarJob` já preserva a linha (só atualiza status); `limparJob` já deleta com RLS/serviço.

Também no `CampanhaDetalheDialog.tsx` (já existente): o botão "Limpar" atual já faz `limparJob`, mantido como está.

---

## 2) Inbox — renderizar imagem + texto + botões da mensagem enviada

### a) Persistir botões do template no envio

Arquivo: `supabase/functions/send-whatsapp-meta/index.ts` (bloco `meta_whatsapp_mensagens.insert`, ~linha 401)

- Extrair botões de `template.variaveis._components` (procurar bloco `type === 'BUTTONS'`).
- Adicionar campo `template_botoes` (jsonb) no insert.

### b) Nova coluna na tabela

Migration:

```sql
ALTER TABLE public.meta_whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS template_botoes jsonb;
```

Sem alteração de RLS/GRANT — herda da tabela.

### c) Renderizar no ChatMessage

Arquivo: `src/components/inbox/ChatMessage.tsx` (`tipo === 'imagem'`, ~linha 182)

Substituir o `return` que devolve apenas a imagem por um bloco vertical:
- Imagem (como hoje, `max-w-[250px]`).
- Se `msg.conteudo` presente → `<p className="whitespace-pre-wrap ...">{msg.conteudo}</p>` abaixo da imagem.
- Se `msg.template_botoes` (array) presente → lista de "pílulas" desabilitadas (mesmo visual do `TemplateWhatsAppPreview`) mostrando `text` de cada botão. Ícone diferente por tipo (URL / QUICK_REPLY / PHONE_NUMBER).

Também estender o tipo `MetaMensagem` (onde estiver definido) para incluir `template_botoes?: any`. Ajustar a query do inbox que traz `meta_whatsapp_mensagens` para incluir a nova coluna (`select('*')` já cobre).

O mesmo tratamento vale para `tipo === 'texto'` com botões: renderizar botões abaixo do texto.

---

## 3) Mapeamento de variáveis `{{1}} {{2}}` no import da planilha

Arquivo: `src/components/meta/MapearColunasImportDialog.tsx`

- Hoje `placeholders` sai só de `extractPlaceholders(template.body_text)`. Quando o `body_text` está vazio no DB (mesmo o template tendo variáveis conhecidas), o seletor não mostra `{{1}}`/`{{2}}`.
- Mesclar duas fontes:
  1. `extractPlaceholders(template.body_text)` (comportamento atual).
  2. Chaves numéricas e nomeadas de `template.variaveis` (ignorando as internas que começam com `_`, ex.: `_components`, `_format`, `_header_image_url`).
- Unir preservando a ordem: primeiro as do body_text, depois as extras de `variaveis` que não apareceram no body.

Arquivo: `src/pages/EnvioMeta.tsx` (botão "Importar Excel", ~linha 1032)

- Desabilitar o botão quando `!template` e mostrar tooltip "Selecione um template antes de importar" — evita o caso "usuário importa antes de escolher o template e não vê variáveis".

---

## Detalhes técnicos

- Coluna nova `template_botoes` (jsonb, nullable). Formato esperado: `[{ type: 'URL'|'QUICK_REPLY'|'PHONE_NUMBER', text: string, url?: string, phone_number?: string }]`.
- Nenhuma mudança em edge functions `envio-meta-massa-*`.
- Nenhuma mudança em RLS/GRANT.
- Sem alteração no fluxo do context de envio (`EnvioMetaSendingContext`).

## Fora de escopo

- Retenção/histórico além dos 30 jobs já carregados.
- Renderizar botões em mensagens antigas já enviadas (não têm `template_botoes` — continuarão só com texto/imagem, como hoje).
- Reprocessar campanhas canceladas (já existe "Reativar").

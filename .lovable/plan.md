# Criar Template estilo Meta com prévia ao vivo + upload de mídia no cabeçalho

## O que muda visualmente

Reorganizar a aba **Criar Template** em duas colunas (igual aos prints da Meta):

```text
┌──────────────────────────────────┬────────────────────────┐
│  Formulário (nome, categoria,    │  Prévia do modelo      │
│  idioma, cabeçalho, corpo,       │  (sticky, atualiza     │
│  rodapé, botões, exemplos)       │   em tempo real)       │
│                                  │                        │
│                                  │  [balão WhatsApp com   │
│                                  │   header + corpo +     │
│                                  │   rodapé + botões]     │
└──────────────────────────────────┴────────────────────────┘
```

- A prévia usa o componente `TemplateWhatsAppPreview` já existente, ligado ao **estado do formulário** (não mais só ao mestre salvo). Cada tecla digitada em nome/corpo/rodapé/botões reflete no balão à direita, com placeholders amarelos para `{{1}}`, `{{2}}` etc.
- No mobile a prévia vira um card empilhado abaixo do formulário.

## Upload de mídia no Cabeçalho

Hoje, ao escolher **Imagem / Vídeo / Documento**, não aparece nenhum campo — é o bug relatado. Corrigir:

- Quando `Cabeçalho = IMAGE | VIDEO | DOCUMENT`, mostrar um campo **"Amostra de mídia"** com:
  - Input de arquivo (`accept` conforme tipo: `image/jpeg,image/png` / `video/mp4` / `application/pdf`).
  - Ao selecionar, upload para o bucket público `meta-template-media` no Storage e salvar a URL em `cabecalho_media_url` no template mestre.
  - Thumbnail/nome do arquivo abaixo do input; botão para remover.
- A prévia à direita passa a mostrar a imagem/vídeo/documento real no topo do balão.

## Envio à Meta com header de mídia

Para a Meta aprovar templates com cabeçalho de mídia é obrigatório enviar `example.header_handle`, obtido via **Resumable Upload API** (não basta a URL). Fluxo no edge function `meta-criar-template-lote`, por instância:

1. Ler `meta_app_id` da tabela `meta_whatsapp_config` (nova chave configurável no admin).
2. `POST https://graph.facebook.com/v20.0/{app_id}/uploads?file_length=..&file_type=..&access_token={token_instancia}` → devolve `id` de sessão.
3. Baixar o arquivo da URL do Storage, `POST https://graph.facebook.com/v20.0/{session_id}` com header `Authorization: OAuth {token}` e body binário → devolve `{ h: "<handle>" }`.
4. Adicionar ao componente HEADER: `format: "IMAGE"`, `example: { header_handle: ["<handle>"] }`.
5. Cachear o handle em `meta_templates_instancia.header_handle` (opcional) para retries.

Se `meta_app_id` não estiver configurado, retornar erro amigável na linha da instância ("Configure META_APP_ID em Config antes de enviar templates com mídia").

## Banco (migração)

- `meta_templates_mestre`: adicionar `cabecalho_media_url text`, `cabecalho_media_mime text`.
- `meta_templates_instancia`: adicionar `header_handle text` (cache do handle Meta).
- Bucket `meta-template-media` (público SELECT — regra do projeto para UAZAPI/Meta baixarem).
- Chave `meta_app_id` documentada em `meta_whatsapp_config` (inserção manual pelo admin, sem UI nova nesta etapa).

## Arquivos afetados

- `src/pages/MetaTemplates.tsx` — split layout na aba Criar, prévia ao vivo, campo de upload condicional.
- `src/components/meta/TemplateWhatsAppPreview.tsx` — já suporta `format: "IMAGE"`; garantir que aceita `mediaUrl` para renderizar a imagem real.
- `supabase/functions/meta-criar-template-lote/index.ts` — fluxo resumable upload quando cabeçalho é mídia.
- Nova migração Supabase (colunas + bucket).

## Custo / impacto

- Storage: uploads pequenos (poucos KB a alguns MB por template) — custo desprezível.
- Sem novas chamadas de IA. Chamadas extras à Meta (uploads) apenas ao criar templates com mídia — cobrança da Meta é zero para uploads.
- Sem impacto em envios existentes (templates só de texto continuam idênticos).

## Fora de escopo

- UI para editar `META_APP_ID` (por ora inserido direto em `meta_whatsapp_config`).
- Suporte a variáveis dentro do cabeçalho de texto além do que já existe.
- O botão condicional de excluir mestre (já entregue na iteração anterior) permanece como está.

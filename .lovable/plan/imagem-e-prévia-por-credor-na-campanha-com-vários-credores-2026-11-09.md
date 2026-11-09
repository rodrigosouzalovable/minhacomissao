# Imagem e prévia por credor na "Campanha com vários credores"

## O que muda para você
No Envio Meta, com a chave "Campanha com vários credores" ligada, logo abaixo de cada credor (Novo Mundo, UME, Odres Cred) em que você escolher um template aparecerá:
1. **Prévia do template** daquele credor, no formato do WhatsApp, já com os dados do primeiro contato da planilha daquele credor.
2. **Escolher imagem** (só quando o template tiver imagem no topo): você pode trocar a imagem daquele credor. Se não escolher, a prévia mostra a imagem aprovada do template.

Cada contato recebe a imagem escolhida para o seu credor. Sem escolha, segue a imagem aprovada (como já funciona hoje). Regras de envio, limites, intervalos e rodízio não mudam.

## Detalhes técnicos
- `src/pages/EnvioMeta.tsx`:
  - Novo estado `imagemPorCredor: Partial<Record<CredorSlug, CampaignImage>>` e contador de uploads em andamento (bloqueia o botão enviar enquanto sobe imagem, reaproveitando `imageUploading`).
  - Em cada linha do credor (multi-credor), quando há template: renderizar `CampaignImagePicker` (se `templateHasImage(g.sample)`, `templateKey = g.key`) e `TemplateWhatsAppPreview` com `imageUrlOverride` = imagem escolhida → `_header_image_url` das instâncias → URL assinada de `meta_templates_mestre.cabecalho_media_url` (busca sob demanda, 1h, só ao selecionar template — sem polling).
  - `sampleVariables` = vars do primeiro destinatário daquele credor.
  - No montar dos itens (linhas ~1569 e ~1649): em multi-credor, aplicar `_campaign_image_path` conforme o credor do contato (`credorByTel`), em vez da imagem única.
  - A prévia/imagem única atual abaixo continua para o modo normal; no modo multi-credor ela fica oculta para não confundir.
- Backend sem mudanças: o envio já respeita `_campaign_image_path` por item.
- Custo: nenhum novo cron/polling; apenas uma URL assinada por template escolhido.

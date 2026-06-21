# Plano: Preview WhatsApp do template na aba "Envio em massa"

Hoje a página `/admin/envio-meta` mostra apenas o texto do template selecionado. Vou substituir esse bloco "TEMPLATE SELECIONADO" por um **preview visual estilo WhatsApp**, igual ao que abre clicando no template em "API Oficial Meta WhatsApp":

- Header com imagem (lendo `_header_image_url` do template) ou texto
- Corpo com variáveis `{{name}}` destacadas com sample (`Rodrigo`)
- Footer cinza ("Este número é certificado pelo WhatsApp Empresas", se houver)
- Botões (SIM / BLOQUEAR CONTATO / etc) renderizados como no WhatsApp (verde, com ícone)
- Mantém embaixo, em texto pequeno, a lista de variáveis mapeadas

## Implementação

- Extrair o JSX de preview do `TemplatePreviewDialog` para um componente reutilizável **`TemplateWhatsAppPreview`** (sem o Dialog, só o "card WhatsApp")
- `TemplatePreviewDialog` passa a usá-lo internamente
- `src/pages/EnvioMeta.tsx`: substituir o bloco "TEMPLATE SELECIONADO" pelo `<TemplateWhatsAppPreview template={tpl} />`

## Arquivos afetados

- `src/components/meta/TemplateWhatsAppPreview.tsx` (novo — só o preview)
- `src/components/meta/TemplatePreviewDialog.tsx` (refatorado para usar o novo)
- `src/pages/EnvioMeta.tsx` (troca o bloco do template selecionado)

Confirma?

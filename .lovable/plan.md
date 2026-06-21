# Upload direto de imagem para templates HSM

Hoje o diálogo de preview do template (`TemplatePreviewDialog.tsx`) só aceita uma URL pública colada manualmente. Vou adicionar um botão de **Upload de imagem** ao lado do campo URL, que envia o arquivo para o storage do Lovable Cloud e preenche a URL pública automaticamente.

## O que vai mudar

1. **Bucket de storage `meta-templates`** (público, leitura pública)
   - Criado via tool de storage.
   - Policy de INSERT/UPDATE/DELETE restrita a usuários autenticados.
   - Policy de SELECT pública (necessário porque a Meta precisa baixar a imagem pelo URL).

2. **`src/components/meta/TemplatePreviewDialog.tsx`**
   - Adicionar botão **"Enviar imagem"** (ícone Upload) ao lado do campo URL + input file oculto.
   - Ao selecionar arquivo:
     - Validar tipo (jpg/png/webp) e tamanho (máx 5 MB — limite da Meta).
     - Fazer upload em `meta-templates/{template_id}/{timestamp}-{filename}`.
     - Pegar `getPublicUrl()`, preencher `imageUrl` no estado.
     - Salvar automaticamente em `meta_whatsapp_templates.variaveis._header_image_url` (mesmo fluxo do botão Salvar atual).
     - Toast de sucesso/erro.
   - Mostrar mini-preview da imagem enviada acima do campo.

3. **Campo URL continua existindo** — usuário ainda pode colar URL externa se preferir.

## Observações importantes

- A Meta exige que a imagem **seja visualmente idêntica** à amostra aprovada no template. O upload não muda esta regra — o usuário precisa enviar exatamente a mesma arte cadastrada na Meta.
- A URL pública do bucket é direta (sem redirect), atende ao requisito da Meta.
- Não há mudança de custo relevante: storage de imagens pequenas (<200 KB cada) é desprezível.

## Arquivos tocados

- `src/components/meta/TemplatePreviewDialog.tsx` (edição)
- Migration nova: policies do bucket `meta-templates` em `storage.objects`
- Bucket `meta-templates` criado via tool

Não preciso que você me envie as imagens aqui — após a implementação, você poderá enviar cada imagem direto pelo próprio diálogo de cada template HSM.
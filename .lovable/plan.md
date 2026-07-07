## Problema

O componente `TemplateWhatsAppPreview` usa uma constante fixa `SAMPLE = "Rodrigo"` para substituir variáveis `{{...}}` do template. Por isso, mesmo quando o usuário digita "Yasmim" no diálogo "Nova conversa Meta", a pré-visualização continua exibindo "Rodrigo".

## Correção

1. **`src/components/meta/TemplateWhatsAppPreview.tsx`**
   - Adicionar prop opcional `sampleName?: string` no componente.
   - Passar esse valor para `renderBodyWithVars` (transformar em função interna ou receber o valor via closure) para que substitua `{{name}}`/variáveis pelo nome real quando fornecido, mantendo `"Rodrigo"` como fallback quando vazio.

2. **`src/components/inbox/meta/MetaNovaConversaDialog.tsx`**
   - Repassar `sampleName={nome.trim() || undefined}` para `<TemplateWhatsAppPreview />`.
   - Como `nome` já está no state e o componente re-renderiza a cada digitação, a pré-visualização atualiza automaticamente enquanto o usuário digita.

## Fora de escopo

- Nenhuma mudança em edge functions, permissões, RLS ou lógica de envio. Somente ajuste visual da pré-visualização.

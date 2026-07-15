## Diagnóstico

O erro "Failed to send a request to the Edge Function" indica que a função `parse-meta-invoice-pdf` não conseguiu ser invocada — nenhum log chegou a ser registrado, o que aponta para **falha de deploy** da função. A causa provável é o import `pdfjs-serverless` via `esm.sh`, que em muitos casos não resolve no runtime do edge function.

## Correção

Substituir a extração de PDF por uma biblioteca compatível com Deno edge runtime:

- Trocar `pdfjs-serverless` (esm.sh) por **`npm:unpdf`** (mesma API do pdf.js mas empacotada para serverless; funciona no Deno edge runtime).
- Manter toda a lógica de regex para valor / número de referência / data (já validada contra o PDF que o usuário enviou).
- Redeployar a função e testar diretamente via curl com um payload PDF real para confirmar o parse.

## Arquivos afetados
- `supabase/functions/parse-meta-invoice-pdf/index.ts` — trocar apenas o import e a chamada de extração de texto (resto do arquivo intocado).

Após redeploy, o botão "Importar fatura" volta a funcionar normalmente. Nenhuma outra parte do sistema é afetada.

# Corrigir erro ao enviar o termo e espaçamento dos botões

## Causa do erro
A mensagem "Failed to fetch dynamically imported module ... jspdf" aparece quando o site foi publicado de novo enquanto a página estava aberta: o navegador tenta baixar o gerador de PDF da versão antiga, que não existe mais. Não é problema no acordo nem no envio.

## O que muda
1. **Gerador de PDF resistente a atualizações**: ao gerar o termo, se o arquivo do gerador não carregar, o sistema tenta de novo automaticamente; se ainda falhar, mostra o aviso "O sistema foi atualizado. Recarregue a página para enviar o termo" com botão de recarregar, em vez do erro técnico. O acordo salvo continua pendente de formalização e o diálogo de termo reaparece após recarregar (comportamento já existente).
2. **Botões "Acordo salvo" e "Enviar termo de acordo na conversa"**: ficam lado a lado com espaço uniforme entre eles (e empilhados com espaço no celular), sem ficarem colados.

## Detalhes técnicos
- `src/lib/termoAcordoPdf.ts` (e `esbocoPdf.ts`, `PontoAdmin.tsx`, que usam o mesmo import): envolver `import('jspdf')`/`jspdf-autotable` num helper com 1 nova tentativa e, em erro de chunk, reutilizar a lógica de recarga de `lazyWithRetry.ts`.
- `LancarAcordoConversa.tsx`: agrupar os dois botões em `div` com `flex flex-wrap gap-3`.
- Sem mudanças de banco, cron ou polling; custo inalterado.

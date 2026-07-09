# Correções na aba "Aplicar em Lote"

## 1. Imagem do cabeçalho não aparece na prévia

Causa: `cabecalho_media_url` guarda o **path do Storage** (bucket privado), não uma URL pública. A prévia tenta usar isso direto no `<img src>` e falha.

Correção em `src/pages/MetaTemplates.tsx` (aba Lote):

- Adicionar `useEffect` que, ao mudar `selMestre`, verifica se o mestre selecionado tem `cabecalho_media_url` + tipo IMAGE. Se sim, chama `supabase.storage.from("meta-template-media").createSignedUrl(path, 3600)` e guarda em `loteMediaUrl`.
- Passar `imageUrlOverride={loteMediaUrl}` para `<TemplateWhatsAppPreview>` na aba de lote (o componente já suporta esse prop).
- Fazer o mesmo tratamento (fallback amigável) para VIDEO/DOCUMENT — mostrar nome do arquivo.

## 2. Template recém-criado não aparece imediatamente em "Aplicar em Lote"

Causa: `salvarMestre` troca de aba antes que o Realtime dispare `carregar()`, então o `<Select>` de templates ainda está com a lista antiga.

Correção:
- Em `salvarMestre`, após o `insert`, obter o registro criado com `.insert(...).select().single()` e **adicionar o novo mestre no início do state `mestres`** (mais rápido que refetch).
- Ainda chamar `carregar()` em paralelo como garantia.
- Pré-selecionar automaticamente o mestre recém-criado (`setSelMestre(novo.id)`) antes do `setTab("lote")` — assim a prévia aparece já com ele selecionado.

## Fora de escopo

- Sem novas migrações, sem mudanças no edge function. Só ajustes de UI/estado no `MetaTemplates.tsx`.
- Custo: zero.

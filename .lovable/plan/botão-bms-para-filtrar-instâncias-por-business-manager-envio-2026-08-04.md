# Botão "BMs" para filtrar instâncias por Business Manager (Envio Meta)

No diálogo "Instâncias" da aba Envio Meta, ao lado de "Sincronizar perfis", entra um botão **BMs** que abre uma lista suspensa com as Business Managers que possuem números conectados. Ao marcar uma ou mais BMs, a lista de instâncias abaixo passa a mostrar apenas os números vinculados a essas BMs.

## Comportamento

- O botão mostra a contagem quando há filtro ativo (ex.: `BMs (2)`).
- A lista suspensa mostra apenas BMs que têm ao menos uma instância ativa vinculada, com o nome da BM e a quantidade de números (ex.: `Facebook Edna (2)`).
- Também aparece a opção `Sem BM vinculada` quando existirem instâncias ativas sem BM.
- Seleção múltipla com checkboxes; opções "Selecionar todas" e "Limpar filtro" dentro do menu.
- Sem nenhuma BM marcada, todas as instâncias continuam aparecendo (comportamento atual).
- "Selecionar todas" (instâncias) passa a agir sobre a lista visível/filtrada, e o aviso de pool e os cards continuam funcionando normalmente.
- A seleção de instâncias já marcadas não é perdida ao filtrar; apenas a exibição muda.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`:
  - Novo estado `bmFiltro: string[]` (ids de BM, com sentinela `__sem_bm__`).
  - Derivar `bmsDisponiveis` via `useMemo` a partir de `instancias` + `bmNomes`: agrupar por `meta_bm_id`, contar instâncias, ordenar por nome.
  - Derivar `instanciasVisiveis` via `useMemo`: sem filtro retorna `instancias`; com filtro retorna as que casam `meta_bm_id` (ou sem BM).
  - Substituir `instancias.map(...)` da lista por `instanciasVisiveis.map(...)`; ajustar o botão "Selecionar todas" para usar `instanciasVisiveis`.
  - UI do botão: `DropdownMenu` com `DropdownMenuCheckboxItem` (componentes shadcn já disponíveis), ícone `Building2` do lucide-react.
- Sem migração de banco e sem mudança em edge functions: usa `meta_bm_id` e o mapa `bmNomes` já carregados.

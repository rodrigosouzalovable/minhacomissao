## Problema

O diálogo de detalhes da campanha (`CampanhaDetalheDialog.tsx`) fica "balançando" para cima e para baixo enquanto está aberto.

## Causa

Dois pontos causam o thrashing de layout a cada polling (8s) + realtime:

1. **`<details open={detalhes.enviados.length > 0 && detalhes.enviados.length <= 20}>`** — Essa prop `open` é reavaliada em toda re-renderização. Conforme os enviados chegam (1, 2, 3…), o React força o `<details>` a abrir/fechar/re-abrir, e ao passar de 20 ele **fecha sozinho**, empurrando o conteúdo para cima. Isso também sobrescreve a interação manual do usuário.

2. **Conteúdo cresce sem âncora de scroll** — a lista de "Enviados"/"Erros" recebe novos itens no topo/fim, e como o `DialogContent` é `overflow-y-auto`, a barra aparece/desaparece e a posição do scroll salta.

## Correção

Editar apenas `src/components/meta/CampanhaDetalheDialog.tsx`:

- Trocar `open={...}` do `<details>` de "Enviados" por **`defaultOpen`** calculado uma única vez no primeiro render (via `useRef` ou `useState` inicial baseado no `job.id`). Assim, o estado aberto/fechado passa a ser controlado pelo usuário e não pisca a cada polling.
- Aplicar o mesmo tratamento nos `<details>` de "Erros" e "Falharam na entrega" que hoje ficam com `open` fixo — trocar por `defaultOpen` para respeitar interação do usuário sem re-forçar o estado.
- Adicionar `overflow-anchor: none` (via `style`) ao container principal do diálogo para evitar que o navegador re-ancore o scroll quando novos itens são inseridos na lista.
- Reservar espaço estável para o bloco "Último: … via …" e "Próximo envio em Xs" (min-height fixa nessas duas linhas) para que a variação de texto não empurre o layout.

## Fora do escopo

Sem mudanças na lógica de envio, workers, contexto ou banco.
# Filtro por qualidade no diálogo "Instâncias" (Envio Meta)

## Objetivo

No diálogo **Instâncias** da aba "Envio meta", adicionar um botão **Qualidade** ao lado do botão **BMs**, para filtrar a lista por qualidade GREEN, YELLOW, RED (e também sem qualidade/UNKNOWN), com opção de limpar o filtro.

## Comportamento

- Botão "Qualidade" ao lado de "BMs" (à direita dele, na mesma linha de "Selecionar todas", "Verificar saúde", "Sincronizar perfis").
- Sem nenhum filtro de qualidade, todas as instâncias continuam visíveis (comportamento atual). O rótulo mostra "Qualidade (N)" quando há filtros ativos.
- Dropdown com checkboxes:
  - GREEN
  - YELLOW
  - RED
  - Sem qualidade (UNKNOWN/sem leitura) — entra como opção para permitir isolar números sem leitura, mantendo GREEN/YELLOW/RED exatamente como pedido.
  - Contagem de instâncias de cada qualidade ao lado do rótulo.
- Item "Limpar filtro" dentro do menu.
- O filtro se **combina** com o filtro de BMs já existente (lista final = instâncias que casam BM escolhida **e** qualidade escolhida).
- "Selecionar todas" / "Limpar seleção" continuam agindo sobre a lista visível/filtrada — sem mudanças extras.
- A seleção já marcada não é perdida ao filtrar; apenas a exibição muda.
- Sem nenhuma mudança em envio, pool, cotas ou permissões.

## Alteração técnica

Somente `src/pages/EnvioMeta.tsx`, espelhando o padrão do filtro de BMs:

- Novo estado `qualidadeFiltro: string[]` (valores `GREEN`, `YELLOW`, `RED`, `SEM_QUALIDADE`).
- `instanciasVisiveis` (useMemo existente, linha ~1080) passa a aplicar os dois filtros: BM **e** qualidade (`saude_quality` normalizado; vazio/UNKNOWN = `SEM_QUALIDADE`).
- Novo `useMemo` `qualidadesDisponiveis` com contagem por qualidade a partir de `instancias`.
- Novo `DropdownMenu` logo após o menu de BMs, com `DropdownMenuCheckboxItem` por qualidade, item "Limpar filtro" e ícone `Gauge` (lucide-react); imports de DropdownMenu já existem no arquivo.
- Sem migração de banco e sem edge function: usa a coluna `saude_quality` já carregada.
- Sem cron, sem polling, sem novo custo no Lovable Cloud.

## Verificação

- Build/typecheck sem erros.
- No diálogo Instâncias: filtrar GREEN mostra só GREEN; combinar BM + qualidade refina a lista; "Limpar filtro" restaura todas.
- "Selecionar todas" respeita a lista filtrada (regra atual de GREEN/UNKNOWN mantida para seleção em massa).

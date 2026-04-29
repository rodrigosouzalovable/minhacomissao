## Adicionar filtro por Data de Criação na aba "Meus Acordos"

Adicionar um novo seletor de data ao lado do filtro "Filtrar por vencimento" para permitir filtrar acordos pela `data de criação` (`criado_em`). O layout será reorganizado para ficar consistente e bonito.

### Mudanças em `src/pages/Acordos.tsx`

1. **Novo estado**
   - Adicionar `const [filtroDataCriacao, setFiltroDataCriacao] = useState<Date | undefined>(undefined);` junto ao `filtroDataVencimento` existente (linha ~419).

2. **Lógica de filtro**
   - Criar helper `matchesCriacaoFilter(acordo)` que compara `format(new Date(acordo.criado_em), 'yyyy-MM-dd')` com a data selecionada.
   - Incluir essa verificação dentro de `filteredAcordos.filter(...)` (linha ~872), junto com `matchesDateFilter(acordo.id)`.

3. **UI dos filtros (linha ~1064)**
   - Inserir um novo `Popover` + `Calendar` ao lado do "Filtrar por vencimento":
     - Botão com ícone `CalendarIcon` e label dinâmica: `"Filtrar por criação"` ou data formatada `dd/MM/yyyy`.
     - Largura igual à do filtro de vencimento (`sm:w-[220px]`) para alinhamento.
     - Botão `X` (ghost icon) para limpar, idêntico ao padrão atual.
   - Reorganizar o container para ficar limpo:
     - Agrupar os dois date pickers + seus botões "limpar" dentro de uma `div` com `flex flex-wrap items-center gap-2`, separando visualmente do campo de busca e do select de status.
     - Manter o `Search` ocupando `flex-1` à esquerda e o `Select` de status à direita, garantindo boa quebra em telas menores (`flex-col sm:flex-row`).

4. **Imports**
   - Já existem `CalendarIcon`, `Calendar`, `Popover`, `format`, `ptBR`, `X`, `cn` — nenhum import novo necessário.

### Layout resultante (desktop)

```text
[ 🔍 Buscar por cliente ou CPF...                ] [ 📅 Vencimento ][x] [ 📅 Criação ][x] [ Status ▼ ]
```

Em mobile, os elementos quebram em coluna mantendo espaçamento `gap-2`/`gap-4`.

### Comportamento

- Os dois filtros de data são independentes e cumulativos (AND): se ambos estiverem definidos, o acordo deve ter parcela com aquele vencimento **e** ter sido criado naquela data.
- O filtro afeta todas as abas (Negociados, Pagos, Realizados, Vencidos, Próximas), pois todas derivam de `filteredAcordos`.
- Limpar com o botão `X` reseta apenas o filtro correspondente.

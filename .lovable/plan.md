
## Plano: Ordenar Cards por Data de Vencimento Mais Recente

### Objetivo
Ordenar os cards nas abas "Próximas ao Vencimento" e "Vencidas" para que acordos com vencimento mais recente (mais próximo do dia atual) apareçam primeiro.

---

### Análise da Situação Atual

**Problema identificado:**
- As abas "Próximas ao Vencimento" e "Vencidas" apenas filtram os acordos, mas não aplicam ordenação por data de vencimento
- Os acordos são carregados ordenados por `criado_em`, não por `data_prevista` das parcelas
- Não temos a data da próxima parcela pendente armazenada de forma acessível para ordenação

---

### Solução

Modificar as consultas que buscam parcelas próximas e vencidas para também retornar a menor `data_prevista` de cada acordo, permitindo ordenar os cards.

---

### Alterações em `src/pages/Acordos.tsx`

#### 1. Alterar o Estado para Armazenar Datas de Vencimento

Criar novos Maps para armazenar a menor data de vencimento por acordo:

```typescript
// Linha ~180 - adicionar novos estados
const [dataProximaPorAcordo, setDataProximaPorAcordo] = useState<Map<string, string>>(new Map());
const [dataVencidaPorAcordo, setDataVencidaPorAcordo] = useState<Map<string, string>>(new Map());
```

---

#### 2. Atualizar Consulta de Parcelas Próximas (linhas 256-266)

Modificar para criar um Map com a menor data de vencimento por acordo:

```typescript
// Parcelas próximas ao vencimento (hoje até +3 dias)
const tresDias = new Date(hoje);
tresDias.setDate(tresDias.getDate() + 3);
const tresDiasStr = tresDias.toISOString().split('T')[0];
const { data: parcelasProximas, error: proximasError } = await supabase
  .from('pagamentos')
  .select('acordo_id, data_prevista')
  .eq('status', 'pendente')
  .gte('data_prevista', hojeStr)
  .lte('data_prevista', tresDiasStr);

if (proximasError) throw proximasError;

// Criar Map com menor data por acordo (mais recente primeiro)
const proximasMap = new Map<string, string>();
parcelasProximas?.forEach(p => {
  const atual = proximasMap.get(p.acordo_id);
  if (!atual || p.data_prevista < atual) {
    proximasMap.set(p.acordo_id, p.data_prevista);
  }
});
setDataProximaPorAcordo(proximasMap);
setAcordosComParcelasProximas(new Set(proximasMap.keys()));
```

---

#### 3. Atualizar Consulta de Parcelas Vencidas (linhas 245-254)

Modificar para criar um Map com a menor data de vencimento por acordo:

```typescript
// Parcelas vencidas
const { data: pagamentosPendentes, error: pendentesError } = await supabase
  .from('pagamentos')
  .select('acordo_id, data_prevista')
  .eq('status', 'pendente')
  .lt('data_prevista', hojeStr);

if (pendentesError) throw pendentesError;

// Criar Map com menor data por acordo (mais antiga = mais urgente)
const vencidasMap = new Map<string, string>();
pagamentosPendentes?.forEach(p => {
  const atual = vencidasMap.get(p.acordo_id);
  if (!atual || p.data_prevista < atual) {
    vencidasMap.set(p.acordo_id, p.data_prevista);
  }
});
setDataVencidaPorAcordo(vencidasMap);
setAcordosComParcelasVencidas(new Set(vencidasMap.keys()));
```

---

#### 4. Aplicar Ordenação nas Listas Filtradas (linhas 422-426)

Adicionar `.sort()` para ordenar por data de vencimento:

```typescript
// Acordos com Parcelas Vencidas - ordenados pela data mais antiga primeiro
const acordosVencidos = filteredAcordos
  .filter(acordo => acordosComParcelasVencidas.has(acordo.id))
  .sort((a, b) => {
    const dataA = dataVencidaPorAcordo.get(a.id) || '';
    const dataB = dataVencidaPorAcordo.get(b.id) || '';
    return dataA.localeCompare(dataB); // Mais antiga primeiro
  });

// Acordos com Parcelas Próximas ao Vencimento - ordenados pela data mais próxima primeiro
const acordosProximos = filteredAcordos
  .filter(acordo => acordosComParcelasProximas.has(acordo.id))
  .sort((a, b) => {
    const dataA = dataProximaPorAcordo.get(a.id) || '';
    const dataB = dataProximaPorAcordo.get(b.id) || '';
    return dataA.localeCompare(dataB); // Mais próxima primeiro
  });
```

---

### Lógica de Ordenação

| Aba | Ordenação | Resultado |
|-----|-----------|-----------|
| Próximas ao Vencimento | Menor `data_prevista` primeiro | Cards que vencem hoje aparecem antes dos que vencem em 3 dias |
| Vencidas | Menor `data_prevista` primeiro | Cards com parcelas vencidas há mais tempo aparecem primeiro (mais urgentes) |

---

### Resumo das Alterações

| Localização | Alteração |
|-------------|-----------|
| Linha ~180 | Adicionar estados `dataProximaPorAcordo` e `dataVencidaPorAcordo` |
| Linhas 245-254 | Criar Map de datas vencidas por acordo |
| Linhas 256-266 | Criar Map de datas próximas por acordo |
| Linhas 422-426 | Aplicar ordenação por data nas listas filtradas |

---

### Seção Técnica

**Estruturas de dados utilizadas:**
- `Map<string, string>` - Mapeia `acordo_id` para a menor `data_prevista` das parcelas
- Ordenação via `localeCompare` funciona corretamente para datas no formato `YYYY-MM-DD`

**Performance:**
- Nenhuma consulta adicional ao banco de dados
- Apenas processamento local dos dados já carregados
- Complexidade O(n log n) para ordenação


## Plano: Corrigir Atualização da Meta após Salvar

### Problema Identificado

Após salvar a meta no modal de edição, a UI não atualiza corretamente. O problema ocorre porque:

1. O estado `metaValor` é atualizado localmente após o save
2. Mas as dependências do segundo `useEffect` incluem objetos `Date` (`dataInicio`, `dataFim`) que são recriados a cada render
3. Isso causa instabilidade nas comparações de dependências do React

### Solução

Simplificar a lógica de refresh criando uma função `refetchData` que pode ser chamada tanto no carregamento inicial quanto após salvar a meta. Também estabilizar as dependências com `useMemo`.

---

### Alterações no Arquivo `src/components/MetasMensal.tsx`

#### 1. Estabilizar cálculos de datas com `useMemo`

```typescript
// Antes (instável - recria objetos a cada render):
const dataInicio = startOfMonth(parseISO(`${mesAno}-01`));
const dataFim = endOfMonth(dataInicio);
const hoje = new Date();

// Depois (estável com useMemo):
const { dataInicio, dataFim, hoje } = useMemo(() => {
  const inicio = startOfMonth(parseISO(`${mesAno}-01`));
  const fim = endOfMonth(inicio);
  const hojeDate = new Date();
  return { dataInicio: inicio, dataFim: fim, hoje: hojeDate };
}, [mesAno]);
```

#### 2. Simplificar dependências do segundo `useEffect`

Reduzir para apenas as dependências essenciais e mover cálculos derivados para dentro do useEffect:

```typescript
useEffect(() => {
  async function fetchData() {
    if (metaValor === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // ... resto da lógica ...
  }

  fetchData();
}, [mesAno, metaValor]); // Apenas dependências primitivas/estáveis
```

#### 3. Forçar refresh após salvar a meta

Adicionar uma chamada para refetch após salvar, garantindo que os dados sejam recarregados:

```typescript
const handleSaveMeta = async () => {
  setSaving(true);
  
  // ... validação e save ...
  
  if (error) {
    console.error('Erro ao salvar meta:', error);
    toast.error('Erro ao salvar meta. Tente novamente.');
  } else {
    toast.success('Meta atualizada com sucesso!');
    setMetaValor(numericValue); // Atualiza o estado
    setEditDialogOpen(false);
    // Os dados serão recarregados automaticamente pelo useEffect
  }
  
  setSaving(false);
};
```

---

### Resumo das Mudanças

| Alteração | Motivo |
|-----------|--------|
| Usar `useMemo` para `dataInicio`, `dataFim`, `hoje` | Evitar recriação de objetos Date a cada render |
| Simplificar dependências do useEffect | Usar apenas `mesAno` e `metaValor` como triggers |
| Mover cálculos derivados para dentro do useEffect | Evitar instabilidade de dependências |

### Resultado Esperado

- Ao salvar uma nova meta, o componente irá re-executar o `useEffect` automaticamente
- Os cards de métricas (Já Recebido, Falta Receber, Necessário/Dia, etc.) serão atualizados
- O ranking de funcionários será recalculado com base na nova meta
- A barra de progresso refletirá o novo valor da meta imediatamente

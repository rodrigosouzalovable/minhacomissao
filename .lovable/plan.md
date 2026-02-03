

## Plano: Corrigir Dashboard Travado no Loading

### Problema Identificado

O componente `MetasMensal` está travado mostrando skeleton (loading) porque o segundo `useEffect` (linha 127-252) tem um problema de **stale closure** - ele usa variáveis memoizadas (`dataInicio`, `dataFim`, `diasUteisRestantes`, `diasPassados`, `totalDiasUteisMes`) dentro do corpo da função mas essas NÃO estão listadas nas dependências do `useEffect`.

Isso causa:
1. O effect roda com valores antigos/undefined das variáveis
2. Os cálculos ficam incorretos
3. O loading nunca termina ou os dados ficam vazios

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/MetasMensal.tsx` | Adicionar dependências faltantes no useEffect |

### Alteração Detalhada

**Arquivo: `src/components/MetasMensal.tsx`**

Linha 252 - Adicionar as dependências faltantes:

```typescript
// ANTES (linha 252):
}, [mesAno, metaValor]);

// DEPOIS:
}, [mesAno, metaValor, dataInicio, dataFim, diasPassados, diasUteisRestantes, totalDiasUteisMes]);
```

### Explicação Técnica

O React requer que todas as variáveis usadas dentro de um `useEffect` estejam listadas no array de dependências. Quando essas variáveis são omitidas:

1. O closure captura o valor inicial da variável
2. Quando a variável muda, o effect não re-executa
3. Mesmo quando re-executa, pode usar valores "stale" (desatualizados)

No caso atual:
- `dataInicio` e `dataFim` são usados para formatar strings de data na query
- `diasPassados` é usado no loop de evolução diária
- `diasUteisRestantes` é usado no cálculo de meta por funcionário
- `totalDiasUteisMes` é usado no cálculo da meta diária

Como essas variáveis vêm de `useMemo` com dependência em `[mesAno]` e outras datas memoizadas, elas são estáveis - então adicioná-las às dependências não vai causar loops infinitos.

### Resultado Esperado

1. O componente vai carregar corretamente após o fix
2. Os cards de metas (Já Recebido, Falta, Necessário/Dia, etc.) serão exibidos
3. O ranking de funcionários será calculado corretamente
4. O gráfico de evolução será renderizado


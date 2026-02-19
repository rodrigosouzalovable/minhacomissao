

## Corrigir preenchimento automatico da taxa acumulada (Selic/INPC)

### Problemas identificados

1. **Data final usa "hoje"**, mas o BCB ainda nao publicou a taxa do dia atual, causando erro 404
2. **Quando nao ha `data_vencimento`**, o campo `dataBase` fica vazio ou igual a hoje, resultando em consulta invalida (mesma data inicial e final)
3. **A Edge Function retorna erro 502** quando o BCB retorna 404, em vez de tratar o erro graciosamente

### Alteracoes necessarias

**1. Edge Function `supabase/functions/consultar-indices/index.ts`**

- Usar `dataFinal` como o dia anterior (D-1) quando `dataFinal` for igual a hoje, pois o BCB publica dados com 1 dia de atraso
- Tratar respostas 404 do BCB como "sem dados" (retornar `taxaAcumulada: 0`) em vez de retornar erro 502
- Validar que `dataInicial < dataFinal` - se forem iguais ou invertidas, retornar `taxaAcumulada: 0` sem chamar a API

**2. Componente `CalculadoraDebitoDialog.tsx`**

- Alterar `fetchTaxa` para usar o dia anterior como `dataFinal` (evitar consultar dados que o BCB ainda nao publicou)
- Garantir que a taxa eh buscada automaticamente ao:
  - Abrir o dialog (se tiver data base valida)
  - Alterar o contrato selecionado
  - Alterar entre Selic e INPC
  - Alterar a data base manualmente
- O campo "Taxa acumulada (%)" continua editavel para ajuste manual, mas sera preenchido automaticamente pela API

### Detalhes tecnicos

**Edge Function - tratamento de erros:**
- Se BCB retornar 404: retornar `{ taxaAcumulada: 0, registros: 0 }` (sem erro 502)
- Se `dataInicial >= dataFinal`: retornar `{ taxaAcumulada: 0 }` imediatamente
- Subtrair 1 dia de `dataFinal` se for a data atual (dados BCB tem lag de 1 dia)

**Componente - logica de data:**
- `dataFinal` no `fetchTaxa`: usar `subDays(hoje, 1)` para garantir que o BCB tenha dados
- Validacao extra: so chamar API se `dataBase < dataFinal`

### Resultado esperado
- Ao abrir a calculadora com um contrato que tem data de vencimento, a taxa Selic ou INPC sera preenchida automaticamente
- Ao informar manualmente a data base, a taxa sera recalculada automaticamente
- Ao trocar entre Selic e INPC, a taxa sera atualizada automaticamente
- O campo permanece editavel para ajustes manuais se necessario
- Nenhum erro 502 sera exibido ao usuario


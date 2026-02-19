

## Cadastrar indices INPC localmente para calculo automatico

### Abordagem

Em vez de depender da API do Banco Central (que tem limitacoes de janela de 10 anos e lag de 1 dia), vamos embutir todos os indices mensais do INPC diretamente no sistema. Quando o usuario selecionar INPC, o calculo sera feito localmente e instantaneamente, sem chamada de API.

A Selic continuara usando a Edge Function (API do BCB), pois eh diaria e nao faz sentido armazenar localmente.

### Alteracoes

**1. Novo arquivo `src/lib/inpcData.ts`**

Criar um arquivo com todos os indices mensais do INPC extraidos da planilha (1979 a 2026), organizados como um mapa `{ "AAAA-MM": taxa }`. Incluir tambem uma funcao `calcularINPCAcumulado(dataInicial, dataFinal)` que:
- Identifica os meses entre as duas datas
- Acumula os indices mensais com a formula: produto de (1 + taxa/100) - 1
- Retorna a taxa acumulada em percentual

**2. Alterar `src/components/devedor/CalculadoraDebitoDialog.tsx`**

- Importar `calcularINPCAcumulado` do novo arquivo
- Quando `tipoCorrecao === 'inpc'`: calcular localmente usando a funcao, sem chamar a Edge Function
- Quando `tipoCorrecao === 'selic'`: manter o comportamento atual (chamar Edge Function)
- Remover o estado de loading para INPC (calculo eh instantaneo)
- O campo "Taxa acumulada (%)" continuara editavel para ajuste manual

### Detalhes tecnicos

**Estrutura dos dados INPC:**
```text
const INPC_MENSAL: Record<string, number> = {
  "1979-04": 3.45,
  "1979-05": 1.76,
  ...
  "2025-12": 0.21,
  "2026-01": 0.39,
};
```

**Funcao de calculo:**
```text
function calcularINPCAcumulado(dataInicial: string, dataFinal: string): number {
  // Iterar meses entre dataInicial e dataFinal
  // Para cada mes, buscar taxa no mapa
  // Acumular: fator *= (1 + taxa/100)
  // Retornar (fator - 1) * 100
}
```

**Logica no componente:**
```text
if (tipoCorrecao === 'inpc') {
  const taxa = calcularINPCAcumulado(dataBase, hoje);
  setTaxaAcumulada(taxa);
} else {
  // chamar edge function para Selic
  fetchTaxa();
}
```

### Resultado esperado

- Ao selecionar INPC: taxa acumulada calculada instantaneamente (sem loading, sem erro de API)
- Ao selecionar Selic: continua consultando a API do BCB
- Todos os indices de 1979 a 2026 disponiveis no sistema
- Calculo correto usando acumulacao composta mes a mes


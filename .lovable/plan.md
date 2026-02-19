

## Calculadora de Atualização de Débito com Correção Monetária Real (Selic/INPC)

### Visão geral
Adicionar um botão "CALCULAR" no card de Contratos da ficha do cliente. Ao clicar, abre um Dialog (pop-up) com calculadora completa que busca as taxas reais da Selic e INPC diretamente das APIs oficiais do Banco Central do Brasil.

---

### 1. Edge Function: `consultar-indices` (nova)

Criar uma edge function que consulta as APIs públicas do BCB (SGS) para obter as taxas acumuladas no período desejado:

- **Selic Diária** - Série 11 do SGS: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA`
- **INPC** - Série 188 do SGS: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.188/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA`

A function recebe a data inicial (vencimento) e data final (hoje), consulta a API do BCB e retorna o fator acumulado para cada índice.

**Arquivo:** `supabase/functions/consultar-indices/index.ts`

---

### 2. Novo componente: `src/components/devedor/CalculadoraDebitoDialog.tsx`

**Interface do Dialog:**
- Select para escolher o contrato (ou "Todos - somar valores")
- Campos exibidos: valor original, data de vencimento, meses de atraso (calculado automaticamente)
- Valores calculados automaticamente:
  - Juros de mora: 1% ao mês (pro-rata)
  - Multa: 2% sobre o valor original
- RadioGroup para escolher correção monetária: **Selic Diária** ou **INPC**
- Ao escolher, o sistema busca a taxa acumulada real da API do BCB
- Campo mostrando a taxa acumulada encontrada (editável para ajuste manual se necessário)
- Select para número de parcelas (1x a 24x)
- Resumo detalhado com todos os valores discriminados
- Tabela de parcelas
- Botão "Baixar PDF"

**Lógica de cálculo:**
```text
multa = valorOriginal * 0.02
juros = valorOriginal * 0.01 * mesesAtraso
correcaoMonetaria = valorOriginal * (taxaAcumuladaBCB / 100)
totalAtualizado = valorOriginal + multa + juros + correcaoMonetaria
valorParcela = totalAtualizado / numeroParcelas
```

Ao alterar parcelas, contrato ou tipo de correção, recalcula em tempo real.

---

### 3. Geração de PDF (jspdf - nova dependência)

PDF detalhado contendo:
- Cabeçalho com dados do devedor (nome, CPF)
- Dados do contrato (credor, número, vencimento)
- Detalhamento completo do cálculo:
  - Valor Original
  - Multa (2%)
  - Juros de mora (1% a.m. x N meses)
  - Correção Monetária (tipo escolhido + taxa acumulada)
  - Valor Total Atualizado
- Tabela de parcelas (número + valor)
- Data de emissão do cálculo

---

### 4. Alteração em `src/pages/DevedorDetalhe.tsx`

- Importar o componente `CalculadoraDebitoDialog` e ícone `Calculator`
- Adicionar botão "CALCULAR" no header do card de Contratos
- Passar props: contratos, devedor

---

### Dados técnicos das APIs do BCB

| Índice | Série SGS | Endpoint |
|--------|-----------|----------|
| Selic Diária | 11 | `api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados` |
| INPC | 188 | `api.bcb.gov.br/dados/serie/bcdata.sgs.188/dados` |

**Taxa Selic atual:** 15,00% a.a. (meta) / 14,90% a.a. (efetiva) - desde jan/2026
**INPC acumulado 12 meses:** ~4,87% (dados recentes)

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/consultar-indices/index.ts` |
| Criar | `src/components/devedor/CalculadoraDebitoDialog.tsx` |
| Editar | `src/pages/DevedorDetalhe.tsx` |
| Instalar | `jspdf` |

### Sem alterações no banco de dados
Todos os cálculos são feitos no frontend, as taxas são consultadas via API pública do BCB.


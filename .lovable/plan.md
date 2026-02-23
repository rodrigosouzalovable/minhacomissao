

# Melhorias na Calculadora de Debito

## Objetivo
Aprimorar a calculadora de atualizacao de debito com 3 melhorias:

1. **Aumentar parcelas para 60x** (atualmente limitado a 24x)
2. **Frequencia de pagamento** - Opcoes: semanal, quinzenal ou mensal
3. **Juros progressivos por parcelamento** - Taxa de juros que aumenta conforme o numero de parcelas

## Detalhes Tecnicos

### Arquivo unico: `src/components/devedor/CalculadoraDebitoDialog.tsx`

### 1. Parcelas ate 60x
- Alterar o `Array.from({ length: 24 })` para `Array.from({ length: 60 })` no Select de parcelas

### 2. Frequencia de pagamento
Novo state `frequencia` com 3 opcoes:
- **Semanal** (a cada 7 dias)
- **Quinzenal** (a cada 15 dias)
- **Mensal** (a cada 30 dias, padrao atual)

Adicionar um RadioGroup abaixo do Select de parcelas com as 3 opcoes.

A frequencia afeta:
- **Tabela de parcelas**: cada linha mostrara a data prevista de vencimento calculada a partir da data do primeiro pagamento (hoje + frequencia x numero da parcela)
- **PDF**: incluira a frequencia escolhida e as datas de vencimento de cada parcela

### 3. Juros progressivos por parcelamento
Adicionar uma taxa de juros mensal sobre o parcelamento que incide sobre o saldo devedor. A logica sera:

- **1x (a vista)**: sem juros de parcelamento
- **2-12x**: 1% a.m. de juros no parcelamento
- **13-24x**: 1,5% a.m. de juros no parcelamento
- **25-36x**: 2% a.m. de juros no parcelamento
- **37-48x**: 2,5% a.m. de juros no parcelamento
- **49-60x**: 3% a.m. de juros no parcelamento

O calculo usara a formula Price (parcelas fixas com juros embutidos):
```
PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
```
Onde:
- PV = valor total atualizado (com multa, juros de mora e correcao)
- i = taxa mensal ajustada pela frequencia (semanal: taxa/4.33, quinzenal: taxa/2, mensal: taxa)
- n = numero de parcelas

O resumo mostrara:
- Valor total atualizado (antes dos juros de parcelamento)
- Taxa de juros do parcelamento aplicada
- Valor de cada parcela (calculado pela tabela Price)
- Valor total a pagar (parcela x numero de parcelas)
- Custo do parcelamento (diferenca entre total a pagar e valor atualizado)

### Layout atualizado

Secao de parcelamento ficara assim:

```text
Parcelamento
[60x v]

Frequencia de Pagamento
(o) Semanal  (o) Quinzenal  (o) Mensal

Taxa de juros do parcelamento: 3% a.m.
```

### Tabela de parcelas atualizada
Cada linha mostrara: Numero da parcela | Data de vencimento | Valor

### PDF atualizado
- Incluira a frequencia de pagamento
- Incluira a taxa de juros do parcelamento
- Cada parcela tera sua data prevista de vencimento
- Mostrara o custo total do parcelamento


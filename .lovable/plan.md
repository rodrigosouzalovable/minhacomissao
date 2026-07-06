## Plano

### 1. Remover juros e mostrar apenas o valor original
- Em `src/pages/ConsultaResultado.tsx`, remover o cálculo de juros para APORTE (`calcularJurosAporte` / `getValorEfetivo`) e passar a exibir e somar sempre `debito.valor_original`.
- Remover a linha "Original: R$ …" abaixo do valor de cada parcela — vai existir apenas um valor por parcela, que é o original.
- `valorTotal` passa a ser a soma simples de `valor_original` de todos os débitos (INADIMPLENTES + APORTE).

### 2. Calcular dias de atraso do cliente
- Considerar dias de atraso = (hoje − menor `data_vencimento` entre todos os débitos em aberto do cliente).
- Se todos os vencimentos forem futuros, tratar como 0 dias de atraso.
- Exibir esse número no topo da tela, num badge próximo ao nome/CPF, ex.: `⏱ 187 dias em atraso com a loja`.

### 3. Novas faixas de desconto (por dias de atraso)
Aplicar o desconto sobre o valor total (INADIMPLENTES + APORTE, sem distinção de carteira):

```text
Dias atraso     À vista   Parcelado
1  – 200        10%       0%   (parcelado sem juros e sem desconto)
201 – 300       20%       10%
301 – 500       30%       20%
501 – 10000     50%       30%
```

- Criar util `src/lib/descontoPortal.ts` com:
  - `getDiasAtraso(debitos)`
  - `getDescontoPortal(diasAtraso, modalidade: 'avista' | 'parcelado')`
- Ajustar `DiscountTierSelector` para receber `diasAtraso` e derivar dinamicamente:
  - percentual à vista e parcelado
  - `avistaValor` = `valorTotal * (1 - descontoAvista/100)`
  - `parceladoValor` = `valorTotal * (1 - descontoParcelado/100)`
  - Se `descontoParcelado === 0`, o card parcelado mostra "sem juros, sem desconto" e o selo "0% OFF" some (fica apenas "Parcele em até 24x sem juros").
- Ajustar `getDesconto` / `getMinParcelas` / `getMaxParcelasFaixa` (ou substituir por props/derivados) para usar as novas faixas.

### 4. Ajustes em `ConsultaResultado.tsx`
- `getValorComDesconto`: aplica o desconto vigente sobre `valorTotal` (não mais só sobre INADIMPLENTES).
- `valorAvista` do hero (o "até 50%") passa a mostrar o desconto real da faixa do cliente ("Aproveite até X% de desconto"), calculado a partir de `diasAtraso`.
- Mensagem do WhatsApp: continua usando o `valorTotal` original e o valor com desconto — só muda a origem do percentual.

### 5. Escopo do que não muda
- Sem alteração no backend, RPC, banco ou custos.
- Sem alteração no fluxo de notificação de consulta por WhatsApp.
- Sem alteração em telas internas (Acordos, Novo Acordo, admin) — regras de comissão continuam iguais.

### Detalhes técnicos
- `calcularJurosAporte` deixa de ser chamado em `ConsultaResultado.tsx` (a função em `src/lib/comissao.ts` permanece, para não afetar outros consumidores).
- Dias de atraso usa `Math.floor((hoje - vencMaisAntigo) / 86400000)` com `setHours(0,0,0,0)`.
- Todas as mudanças ficam confinadas a: `src/pages/ConsultaResultado.tsx`, `src/components/negociacao/DiscountTierSelector.tsx`, novo `src/lib/descontoPortal.ts`.

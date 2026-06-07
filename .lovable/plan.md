## Alterações em `src/pages/Financeiro.tsx` (aba Análise)

### 1. Nova estrutura da tabela
Trocar as colunas atuais (`Funcionário | Gastos | Receita Gerada | Resultado`) por:

```
Funcionário | Gastos | Receita Gerada | Comissão Funcionário | Comissão Escritório | Resultado
```

- **Receita Gerada**: soma de `valor_parcela` de todas as parcelas pagas do funcionário no período (valor bruto recebido pelo escritório, independente da tabela).
- **Comissão Funcionário**: quanto o funcionário ganhou de comissão sobre essas parcelas.
- **Comissão Escritório**: quanto o escritório ganhou (líquido da comissão paga).
- **Gastos**: continua somando apenas `gastos_funcionarios` daquele funcionário (sem ratear Gastos Empresa, conforme decidido).
- **Resultado**: `Comissão Escritório − Gastos do funcionário` (lucro real que o funcionário gera para o escritório).

### 2. Cálculo respeitando empresa do acordo
Buscar `acordos.empresa` (já vem no join) e aplicar a tabela correta por parcela:

- `empresa = 'MONTREAL'` → `calcularComissaoMontrealParcela` (funcionário) e `valor_parcela − comissão funcionário` (escritório) — Montreal tem apenas comissão do funcionário; o restante é do escritório.
- `empresa = 'MUNDO DA MODA'` (ou equivalente) → `calcularComissaoMundoDaModa` para funcionário, `calcularPercentualComissaoEmpresa` (tabela MdM se houver, senão padrão) para escritório.
- Demais → `calcularPercentualComissaoFuncionario` (funcionário) + `calcularPercentualComissaoEmpresa` (escritório), ambos sobre `valor_parcela` e `dias_atraso`.

Criar helper local `calcularRepartePagamento(pagamento)` que retorna `{ receita, comissaoFuncionario, comissaoEscritorio }` para uma parcela, centralizando o switch por empresa.

### 3. Query
A query atual de `pagamentosPagos` já traz `acordos(user_id, dias_atraso, ...)`. Adicionar `empresa` ao select para o cálculo. Sem mudanças de schema.

### 4. Layout
- Manter ordem alfabética atual.
- Comissão Funcionário em texto neutro (`text-foreground`), Comissão Escritório em `text-green-600` (é o que entra de fato).
- Cabeçalhos `text-right` para as 4 colunas numéricas.

## Verificação

- Para um acordo Montreal 1x pago R$ 1.000 com 5 dias de atraso: Receita = 1000, Comissão Func conforme tabela Montreal, Escritório = 1000 − comissão func.
- Para acordo padrão: Comissão Func + Comissão Escritório = % funcionário + % empresa sobre a parcela.
- Resultado = Comissão Escritório − Gastos funcionário (sem rateio de Gastos Empresa).
- Resumo geral (outras abas) permanece igual.

## Sobre cadastro de salário/VA/custos
Esses cadastros **já existem** hoje nas abas "Gastos Empresa" e "Gastos Funcionários" (categorias salário, vale alimentação, aluguel, energia, internet, sistema etc.). Esta tarefa apenas usa os dados que já são cadastrados ali. Nenhuma migration ou tabela nova é necessária.

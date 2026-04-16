

## Importar Planilha Multi-Credor (INADIMPLENTES + APORTE) com Juros Automáticos

### Contexto

A planilha tem 8 colunas: A=CPF, B=Nome, C=Credor, D=Contrato, E=Nº Parcela, F=Vencimento, G=Valor Parcela, H=Valor Total. Contém dois tipos de credor:
- **UME | NOVO MUNDO - INADIMPLENTES**: mantém desconto de 50% à vista e 30% parcelado (comportamento atual)
- **UME | NOVO MUNDO - APORTE**: aplica **juros** sobre o valor da parcela baseado nos dias de atraso

### O que será feito

#### 1. Novo layout de importação "UME Consolidado"
Criar um novo layout na página Importar Devedores que lê as 8 colunas, agrupa por CPF+Contrato e importa como `devedores` com o campo `credor` diferenciando entre `ume_novo_mundo` (inadimplentes) e `ume_novo_mundo_aporte` (aporte).

#### 2. Tabela de juros para APORTE
Adicionar em `src/lib/comissao.ts` a tabela de juros:
- 1-30 dias: 7%
- 31-90 dias: 15%
- 91-180 dias: 20%
- 181-365 dias: 27%
- 366+ dias: 36%

E uma função `calcularJurosAporte(valorParcela, diasAtraso)` que retorna o valor com juros.

#### 3. Portal público: cálculo automático de juros para APORTE
No `ConsultaResultado.tsx`, ao exibir débitos:
- Se o credor do débito contém "APORTE" → calcular dias de atraso (vencimento → hoje) e aplicar juros sobre `valor_original`, exibindo o `valor_atualizado` com juros
- Se o credor é INADIMPLENTES → manter comportamento atual (desconto 50%/30%)

A lógica será: ao carregar os débitos via `consultar_debitos_por_cpf`, o frontend verifica o campo `credor` de cada débito e, para os que são APORTE, recalcula o valor com juros em tempo real.

#### 4. Diferenciação na negociação do portal
- Débitos APORTE: mostrar valor original + juros calculados, sem oferecer desconto (o cliente paga o valor + juros)
- Débitos INADIMPLENTES: manter desconto 50% à vista e 30% parcelado

### Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/lib/comissao.ts` | Nova tabela `tabelaJurosAporte` e função `calcularJurosAporte()` |
| `src/pages/ImportarDevedores.tsx` | Novo layout `'ume_consolidado'` com parser para 8 colunas, gravar credor como `ume_novo_mundo` ou `ume_novo_mundo_aporte` |
| `src/pages/ConsultaResultado.tsx` | Detectar débitos APORTE, calcular juros em tempo real, separar lógica de negociação por tipo de credor |
| `src/components/negociacao/DiscountTierSelector.tsx` | Não alterar — será usado apenas para INADIMPLENTES |

### O que NÃO muda
- Tabelas do banco (usa `devedores` existente, campo `credor` já existe)
- Nenhuma migration necessária
- Sem aumento de custo




## Plano: Separar aba Vencidas e criar aba Acordos Realizados

### Resumo

A aba "Vencidas" atual sera dividida em duas:
- **Acordos Realizados** (nova aba): clientes com parcelas vencidas que **nao pagaram nenhuma parcela**
- **Vencidas** (aba existente): clientes com parcelas vencidas que **ja pagaram alguma parcela** mas deixaram as subsequentes vencerem

### Mudancas no codigo (`src/pages/Acordos.tsx`)

#### 1. Atualizar o tipo da aba ativa
Adicionar `'acordos_realizados'` ao tipo union do estado `abaAtiva`.

#### 2. Criar a nova lista filtrada
```
acordosRealizados = acordos com parcelas vencidas E SEM nenhuma parcela paga
acordosVencidos = acordos com parcelas vencidas E COM pelo menos 1 parcela paga
```

Logica atual:
- `acordosVencidos` = todos com parcelas vencidas

Nova logica:
- `acordosRealizados` = `acordosComParcelasVencidas` E **nao** `acordosComPagamentosPagos`
- `acordosVencidos` = `acordosComParcelasVencidas` E `acordosComPagamentosPagos`

#### 3. Atualizar a grid de abas
De `grid-cols-4` para `grid-cols-5`, com a ordem:
1. Negociados
2. Pagos
3. Proximas ao Vencimento
4. **Acordos Realizados** (nova)
5. Vencidas

#### 4. Adicionar TabsContent para a nova aba
Renderizar os cards de `acordosRealizados` com a mesma estrutura das outras abas.

#### 5. Atualizar `acordosExibidos` e exportacao Excel
Incluir o caso `'acordos_realizados'` no ternario e no nome do arquivo Excel.

### Arquivos modificados
- `src/pages/Acordos.tsx`

Nenhuma mudanca no banco de dados e necessaria.


## Plano: MM/AAAA + Replicar meses (Financeiro)

Escopo: aba **Financeiro** (`src/pages/Financeiro.tsx`) — Gastos Funcionários, Gastos Empresa e Receitas.

### 1. Exibição como MM/AAAA
Trocar nas 3 tabelas a célula da coluna "Data Ref.":
```tsx
{format(parseISO(item.data_referencia), 'MM/yyyy')}
```
(`parseISO` importado de `date-fns`.)

### 2. Inputs do diálogo viram seletor de mês
Nos 3 diálogos (Gasto Empresa / Gasto Funcionário / Receita):
- `<Input type="date">` → `<Input type="month">`.
- State guarda `yyyy-MM` (slice 0,7 do valor atual em edição).
- Ao salvar, persiste como `yyyy-MM-01` no banco.

### 3. Botão "Replicar meses" (3 abas)
Novo botão ao lado de "Adicionar Gasto"/"Adicionar Receita". Abre o mesmo componente `ReplicarMesesDialog` reaproveitável, parametrizado pela tabela alvo (`gastos_empresa` | `gastos_funcionarios` | `receitas_empresa`).

Conteúdo do diálogo:
- **Mês de origem** (`type="month"`, padrão = mês mais recente com registros).
- **Meses de destino** — grade com checkboxes dos 12 meses anteriores + 12 posteriores ao mês de origem (rótulo MM/AAAA). Botões rápidos "Marcar 6 anteriores" / "Marcar 6 posteriores".
- Resumo: "X lançamentos serão copiados para Y meses."

Comportamento ao confirmar:
1. Busca todos os registros da tabela com `data_referencia` entre o primeiro e o último dia do mês de origem.
2. Para cada mês destino:
   - Verifica se já existe algum registro no mês (qualquer registro) — se sim, **pula** o mês e adiciona ao contador "pulados".
   - Caso contrário, monta array com os mesmos campos da origem (sem `id`/`criado_em`) trocando `data_referencia` para `yyyy-MM-01` do destino.
3. Faz um único `.insert(arrayCombinado)` no final.
4. Toast: "Replicado para N meses · M meses pulados (já tinham lançamentos)."
5. Invalida as queries da tabela alterada.

Para Gastos Funcionários, "já tinham lançamentos" é checado **por funcionário** (não por mês inteiro), para permitir adicionar novo funcionário a um mês existente sem duplicar os que já estão lá. Para Empresa e Receitas, "já tinham" é checado por mês inteiro (mais simples e seguro).

### 4. Verificação
- Cadastrar um novo gasto → campo é seletor de mês; tabela mostra "06/2026".
- Replicar 06/2026 → 05/2026 e 07/2026: cria duplicatas com `data_referencia = 2026-05-01` e `2026-07-01`, respectivamente.
- Replicar novamente para os mesmos meses → toast "0 replicados, X pulados".
- Aba Análise (que já usa último mês com lançamento por funcionário) reflete o mês mais recente automaticamente.

### Fora de escopo
- Sem migration. Coluna `data_referencia` continua `date`, sempre dia 01 quando salva via seletor de mês. Lançamentos antigos com outras datas continuam funcionando — agrupados pelo mês.

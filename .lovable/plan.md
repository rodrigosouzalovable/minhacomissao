## Problema identificado

Dois bugs em `src/components/relatorios/ImportarLigacoesDialog.tsx`:

**1. CobMais sobrescreveu a importação do 3C Plus**
O modo padrão é `substituir`, e no caminho CobMais ele grava `tentativas/cpc/cpca` com os valores da própria planilha — zerando o que o 3C já havia escrito naquelas faixas.

**2. Apenas uma data é importada (a "dominante")**
Hoje o parser CobMais agrupa por hora em um único `Contagem`, e `dataAlvo` é a data com mais linhas (`dataDetectada`). Se a planilha cobre vários dias (ex.: 28/05 e 29/05), só a data majoritária é salva — por isso 29/05/2026 ficou "sem informação correta".

## Mudanças (somente em `ImportarLigacoesDialog.tsx`)

### Parser CobMais multi-data
- Trocar `contagem: Contagem` por `contagemPorData: Record<string, Contagem>` em `Resumo` (CobMais).
- Para cada linha válida, incrementar em `contagemPorData[dataIso][faixa]`.
- Manter `dataDetectada` (data dominante) só como sugestão visual.
- 3C Plus segue igual (uma data só).

### UI de revisão CobMais
- Mostrar lista de datas detectadas com totais por data (chips).
- Substituir o campo único "Data alvo" por:
  - **Checkbox "Importar todas as datas detectadas"** (default: ligado).
  - Se desligado, reaparece o seletor de data única (comportamento atual).
- A tabela de pré-visualização vira: tabs por data, ou um seletor que troca qual `Contagem` é exibido.

### Modo padrão e gravação
- **Default do `modo` passa a ser `somar`** quando origem é CobMais (e mantém `substituir` como default para 3C, que é o caso típico de re-importar o mesmo arquivo).
- No `confirmar()`, iterar sobre cada data selecionada e fazer o mesmo loop atual (`upsert` + log) para cada `(data, faixa)`.
- Manter a regra: 3C nunca toca `whatsapp/alo`; CobMais escreve todas as 5 colunas.
- Mensagem de toast final passa a incluir o número de datas atualizadas.

### Texto explicativo
- Acrescentar abaixo do RadioGroup de modo, quando CobMais:
  > "Use **Somar** para combinar com uma importação anterior (ex.: 3C Plus). Use **Substituir** apenas se quiser reimportar o mesmo CobMais."

## Não muda
- Schema do banco, RPC, RLS, edge functions — nada.
- Importação 3C Plus continua exatamente igual.
- Trigger de `acordos_valor` continua intocada.
- Sem custo adicional na Lovable Cloud.

## Detalhes técnicos
- `Resumo` ganha campos opcionais `contagemPorData?: Record<string, Contagem>` e `datas?: string[]` (ordenadas desc por nº de linhas). Para 3C, esses campos ficam vazios e o código segue lendo `contagem`.
- Estado novo: `datasSelecionadas: string[]` e `importarTodas: boolean` (default `true` em CobMais).
- Ao confirmar, montar `const alvos = isCob && importarTodas ? resumo.datas! : [dataAlvo]` e loopar o bloco de upsert para cada data, usando `resumo.contagemPorData![data]` em CobMais e `resumo.contagem` em 3C.
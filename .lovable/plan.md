## O que muda em `src/pages/EnvioMeta.tsx`

### 1. Botão "Baixar Excel" dos contatos com WhatsApp
No bloco de resultado da validação (junto do badge "✅ 2311 com WhatsApp" e do botão "Remover sem WhatsApp"), adicionar botão **"Baixar Excel (com WhatsApp)"**.

- Fica visível assim que `validacaoPreview.valid.length > 0`.
- Usa a função `exportarParaExcel` de `src/lib/exportExcel.ts` (lazy-load do xlsx, já existe no projeto).
- Colunas: `Telefone` + qualquer cabeçalho extra que já tenha vindo na base colada (`recipientsHeaders` — nome, cpf, etc.), preservando os valores originais de cada linha só para os telefones que passaram na validação.
- Nome do arquivo: `contatos-com-whatsapp-YYYY-MM-DD.xlsx`.

Também exponho o mesmo botão numa forma reduzida ao lado do resumo, para ficar fácil de achar depois do "Validar agora".

### 2. Preview da divisão do Modo Rajada
Confirmando o comportamento atual: **sim**, tanto o modo normal quanto o Modo Rajada distribuem os contatos em **round-robin** entre as instâncias marcadas (o worker recebe `instanciaIds` e itera). Com 2.311 contatos e 2 instâncias, cada uma pega ~1.156.

Hoje isso não aparece na UI. Vou adicionar um **card de "Divisão por instância"** que só aparece quando `modoRajada === true` E existem contatos + instâncias marcadas:

- Cabeçalho: "⚡ Divisão da rajada — X contatos ÷ Y instâncias"
- Lista cada instância selecionada com:
  - Nome + telefone da instância
  - Quantos contatos vão para ela (round-robin, então `ceil` para as primeiras `resto` instâncias e `floor` para as demais)
  - Barra de progresso visual proporcional
- Se houver validação feita, usa `validacaoPreview.valid.length`; senão usa `recipientsDedup.length` (total após dedupe).
- Nota curta: "Cada instância dispara em paralelo, sem delay, todos os seus contatos ao mesmo tempo."

Esse card fica logo abaixo do checkbox de Modo Rajada e antes dos campos de Mín/Máx (que já ficam esmaecidos quando rajada está ligada).

### Detalhes técnicos

- **Divisão round-robin exata**: para N contatos e K instâncias, a instância na posição `i` (0-indexada) recebe `Math.floor(N/K) + (i < N % K ? 1 : 0)`. Aplico essa fórmula tanto no preview quanto na descrição.
- **Não altero** o worker de disparo nem a Edge Function — a distribuição real já é round-robin no envio; só estou espelhando na UI.
- **Exportação Excel**: reutilizo `exportarParaExcel<T>(dados, colunas, nomeArquivo)` já existente. Sem novas dependências.
- Nenhuma alteração de backend, RLS, ou tabela.

### Fora de escopo
- Não mexo em regras de qualidade RED/YELLOW, custos, ou validação.
- Não altero comportamento do modo normal (delay 30-90s continua igual).

## Importação de planilha de ligações na aba Relatórios

Sim, é totalmente possível. A planilha (CSV separado por `;`) tem a coluna **`call_date`** (coluna AL) no formato `"29/05/2026 07:59:58"` — basta o sistema ler essa coluna, agrupar por faixa horária e gravar na coluna **TENTATIVAS** do dia.

### O que vou adicionar (somente admin)

Na página `/relatorios`, novo botão **"Importar planilha de ligações"** ao lado dos botões existentes (Exportar CSV / Resetar dia).

### Fluxo ao clicar no botão

1. Abre um dialog para escolher arquivo (`.csv`, `.xlsx`, `.xls`).
2. Sistema lê o arquivo **no navegador** (usa `xlsx` que já está no projeto e suporta CSV com `;`).
3. Detecta automaticamente a coluna `call_date` (fallback: coluna AL / índice 37 se o cabeçalho mudar).
4. Faz o parse das datas no formato `DD/MM/YYYY HH:MM:SS` e mostra um **resumo prévio**:
   - Data detectada na planilha (ex.: 29/05/2026)
   - Total de linhas lidas / linhas com data válida / ignoradas
   - Contagem por cada faixa horária (8h-9h, 9h-10h … 18h-19h)
5. Usuário escolhe:
   - **Faixa inicial** (select: 8h-9h … 18h-19h)
   - **Faixa final** (select: 8h-9h … 18h-19h)
   - **Data alvo** (default = data detectada na planilha, editável)
   - **Modo**: `Substituir` (define o valor exato) ou `Somar` (adiciona ao valor atual)
6. Botão **Confirmar** — para cada faixa no intervalo escolhido, grava em `relatorio_acionamentos.tentativas` via upsert e registra um log em `relatorio_acionamentos_log` com `acao = 'importacao_planilha_tentativas'`.

### Regras de parsing

- Cabeçalho da coluna: procurar por `call_date` (case-insensitive). Se não achar, usar a 38ª coluna (índice 37 = AL).
- Linhas sem `call_date` válido são descartadas (contabilizadas em "ignoradas").
- Faixa horária = hora cheia do `call_date` (ex.: `09:47:12` → faixa `9h-10h`). Linhas fora de 8h–19h ficam em "fora do expediente" (mostradas, mas não gravadas).
- Toast de sucesso ao final com resumo: "X faixas atualizadas, Y ligações importadas".

### Arquivos afetados

- `src/pages/Relatorios.tsx` — botão + novo dialog de importação (componente inline ou separado).
- Sem migração de banco — usa as tabelas e a estrutura que já existem.
- Sem custo extra de Lovable Cloud (processamento no navegador, apenas writes pontuais no Postgres).

### Pontos a confirmar

- Os horários da planilha estão no fuso de Brasília? (Assumo que sim — é o mesmo fuso da aba Relatórios.)
- Modo padrão deve ser **Substituir** ou **Somar**? (Proponho **Substituir** como default, já que você importa a planilha completa do dia/período.)

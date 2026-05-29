## Adicionar coluna WhatsApp em Relatórios

Adicionar uma nova coluna chamada **WhatsApp** entre as colunas **TENTATIVAS** e **ALO** na tabela do Relatório de Acionamentos.

### Comportamento
- Coluna funciona igual às colunas Tentativas/Alô/CPC/CPC-A: contador por faixa de hora, com botão `+` para incrementar (cooldown de 2s) e botão de editar (lápis) visível só para admin.
- Linhas TOTAL/MÉDIA incluem o novo somatório.
- Exportação CSV passa a incluir a coluna WhatsApp.
- A coluna **não** entra em nenhum cálculo de porcentagem (% ALO, % CPC, % Conversão permanecem como estão).

### Mudanças técnicas

**Banco (migration):**
- `ALTER TABLE public.relatorio_acionamentos ADD COLUMN whatsapp INTEGER NOT NULL DEFAULT 0;`
- Atualizar a função `incrementar_metrica_acionamento` para aceitar `'whatsapp'` como valor válido em `p_coluna`.

**Frontend (`src/pages/Relatorios.tsx`):**
- Adicionar `whatsapp: number` no tipo `Linha` e em `ColunaIncr` (`'tentativas' | 'whatsapp' | 'alo' | 'cpc' | 'cpca'`).
- Inicializar `whatsapp: 0` no `map` do `load` e mapear `r.whatsapp` no fetch.
- Incluir `whatsapp` em `totais` (soma).
- Adicionar `<th>WHATSAPP</th>` entre TENTATIVAS e ALO no cabeçalho.
- Incluir `'whatsapp'` na ordem do array `(['tentativas','whatsapp','alo','cpc','cpca'])` que renderiza as células editáveis/incrementáveis.
- Linha TOTAL: adicionar `<td>{totais.whatsapp}</td>` na posição correta.
- Linha MÉDIA: adicionar célula `--` na posição.
- `exportCSV`: adicionar `'WHATSAPP'` no cabeçalho e `l.whatsapp` em cada linha + `totais.whatsapp` no TOTAL + `'--'` na MÉDIA.

Sem mudanças no dialog de importação de planilha (continua atualizando apenas Tentativas).

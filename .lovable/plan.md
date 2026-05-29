## Importar CPC e CPC-A da planilha (coluna T = qualification_name)

Sim, é totalmente possível. Vou estender o diálogo de importação existente para ler a coluna `qualification_name` (coluna T) além da coluna AL (`call_date`), classificando cada linha por horário em três contadores.

### Regra de classificação

Por linha válida da planilha:
- `qualification_name = "Acordo"` → conta em **CPC-A** (coluna `cpca`)
- `qualification_name = "Contato com Cliente"` → conta em **CPC** (coluna `cpc`)
- Toda linha com `call_date` válido continua contando em **Tentativas** (coluna `tentativas`), como já é hoje
- Demais qualificações ("Não qualificada", vazias, etc.) → ignoradas para CPC/CPC-A, mas continuam somando em Tentativas

A faixa de hora vem sempre do `call_date` (mesma lógica já usada). Comparação de qualificação é case-insensitive e ignora espaços extras.

### Fluxo no diálogo (`ImportarLigacoesDialog.tsx`)

1. Ao ler a planilha, montar 3 mapas por faixa: `contagem.tentativas`, `contagem.cpc`, `contagem.cpca`.
2. Mostrar no resumo (preview) uma tabela com 4 colunas por faixa: **Faixa · Tentativas · CPC · CPC-A**.
3. Manter os seletores de hora inicial / hora final e o modo "Substituir / Somar" — aplicam às três métricas.
4. Ao confirmar, para cada faixa no intervalo, fazer upsert em `relatorio_acionamentos` gravando `tentativas`, `cpc` e `cpca` (substituir ou somar conforme o modo). Cada coluna gera seu próprio registro de log em `relatorio_acionamentos_log` (`importacao_planilha_tentativas`, `importacao_planilha_cpc`, `importacao_planilha_cpca`).
5. Coluna **WhatsApp** continua intocada pela importação (segue manual).
6. Toast final passa a informar: "X faixa(s) atualizada(s) — T tentativas · C CPC · A CPC-A".

### Observações

- Nenhuma migração de banco — colunas `cpc` e `cpca` já existem em `relatorio_acionamentos`.
- Nenhuma mudança no `Relatorios.tsx` ou nas RPCs.
- Linhas com hora fora do expediente (antes das 08h ou depois das 19h) continuam contadas em "fora do expediente" e não entram em nenhum contador.

Confirma esse mapeamento ("Acordo" → CPC-A, "Contato com Cliente" → CPC)?

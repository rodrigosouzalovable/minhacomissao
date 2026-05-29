## Ajuste no diálogo "Importar planilha de ligações"

Trocar os seletores de **Faixa inicial / Faixa final** (hoje "8h-9h", "9h-10h"...) por seletores de **hora única**, alinhados com as colunas da aba Relatórios.

### Mudanças em `src/components/relatorios/ImportarLigacoesDialog.tsx`

1. Renomear os campos visíveis:
   - "Faixa inicial" → **"Hora inicial"**, opções `08h, 09h, 10h, ... 18h`
   - "Faixa final" → **"Hora final"**, opções `09h, 10h, ... 19h`
   - Padrões: inicial = `08h`, final = `19h`

2. Interpretação: a importação cobre todas as faixas cuja hora de início está entre `horaInicial` e `horaFinal - 1` (ex.: 08h → 18h grava as faixas `8h-9h` até `18h-19h`).

3. A tabela de pré-visualização continua mostrando todas as 11 faixas do dia (`8h-9h` ... `18h-19h`) com a contagem — não muda.

4. Internamente o código continua usando o array `HORAS` (`'8h-9h'`...) para fazer o `upsert` em `relatorio_acionamentos`. Só a UI dos dois selects muda.

5. Validação: se `horaFinal <= horaInicial`, exibe toast de erro "Hora final deve ser maior que a hora inicial".

Nenhuma alteração de banco, lógica de parse da coluna AL ou modo Substituir/Somar.

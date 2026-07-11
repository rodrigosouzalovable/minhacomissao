# Batimento de CPFs — Portal de Negociação

Adicionar um novo card na página `/admin/importar-devedores` que permite subir uma planilha (xlsx/csv) com uma coluna de CPFs e devolver um arquivo `.xlsx` contendo apenas os CPFs que **não** estão presentes no portal de negociação.

## Definição de "presente no portal"

Um CPF é considerado presente quando existe pelo menos uma parcela em aberto que apareceria no portal público hoje. Ou seja, para o CPF (normalizado em 11 dígitos):

- Existe linha em `devedores` com `ativo = true` **E**
- (a parcela não está paga: `pago IS NOT TRUE`) **E**
- Não existe acordo ativo (`acordos.status = 'ativo'`) cobrindo aquela parcela

Se todas as pendências do CPF estão quitadas por um acordo ativo (portal exibe as parcelas do acordo em vez das originais — regra `active-agreement-sync-logic`), o CPF continua "presente" desde que o acordo tenha parcelas em aberto. Ausente = CPF sem qualquer débito exibível no portal.

## UI

Novo card em `src/pages/ImportarDevedores.tsx`, abaixo do card "Upload de Planilha" e acima do "Histórico de Importações":

```text
┌─ Batimento de CPFs no Portal ─────────────────────┐
│ Envie uma planilha com uma coluna de CPFs.         │
│ O sistema devolve um .xlsx com os CPFs que NÃO    │
│ estão no portal de negociação.                    │
│                                                    │
│ [Escolher arquivo]  arquivo.xlsx (1.234 CPFs)     │
│ [Rodar batimento]                                  │
│                                                    │
│ Resultado: 312 ausentes de 1.234                  │
│ [Baixar CPFs ausentes.xlsx]                       │
└────────────────────────────────────────────────────┘
```

- Aceita `.xlsx`, `.xls` e `.csv`.
- Primeira coluna = CPF (ignora cabeçalho se a primeira linha não for número/CPF válido).
- Normaliza para 11 dígitos, remove duplicados e vazios.
- Processamento client-side (sem edge function): lê planilha com `xlsx`, consulta o Supabase em lotes de 500 CPFs via `.in('cpf', [...])`, monta a saída com `exportarParaExcel`.
- Feedback: progresso "Verificando lote X/Y…" e toast ao final.
- Botão de download só aparece após o batimento; nome do arquivo: `cpfs-ausentes-portal-YYYY-MM-DD.xlsx`.

## Detalhes técnicos

- Novo componente: `src/components/BatimentoCpfsPortalCard.tsx`.
- Reutiliza `xlsx` (já usado em `parseCobmaisPlanilha.ts`) e `exportarParaExcel` de `src/lib/exportExcel.ts`.
- Query por lote:
  ```ts
  supabase
    .from('devedores')
    .select('cpf, pago, acordo_id')
    .in('cpf', loteCpfs)
    .eq('ativo', true)
  ```
  Depois, para cada CPF, considerar presente se existir ao menos uma linha com `pago IS NOT TRUE` cujo `acordo_id` é `NULL` **ou** cujo `acordo` está com `status = 'ativo'` e tem parcelas em aberto (`acordos_devedor` com `pago IS NOT TRUE`). Para simplificar, faz-se uma segunda consulta agregada em `acordos_devedor` juntando por `cpf` no mesmo lote.
- Saída: `.xlsx` com única coluna `CPF` (formatada como texto para preservar zeros à esquerda), ordenada.
- Nada é gravado no banco — é apenas leitura e download.

## Fora do escopo

- Não altera o fluxo de importação existente.
- Não cria tabela, migração, edge function nem RLS nova.
- Não altera o portal de negociação em si.

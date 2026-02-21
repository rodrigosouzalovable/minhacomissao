

## Importacao em lotes para planilhas grandes (319k+ linhas)

### Problema

O arquivo tem 319 mil linhas. O processo atual falha em dois pontos:
1. **Parsing**: `XLSX.utils.sheet_to_json` tenta converter todas as 319k linhas de uma vez, consumindo muita memoria do navegador
2. **Insercao no banco**: `supabase.insert(records)` envia todos os registros em uma unica requisicao HTTP, causando timeout ou erro de payload

### Solucao

Processar o parsing e a insercao em lotes, com barra de progresso visual.

**Arquivo: `src/pages/ImportarDevedores.tsx`**

#### 1. Parsing em lotes (parseCobmais)

O parsing ja funciona com o `sheet_to_json` completo (ele consegue ler 319k linhas, o problema e a insercao). Mas como seguranca, vamos adicionar um log do total de linhas lidas para confirmar que o parsing nao esta truncando.

#### 2. Insercao em lotes no handleImport

Substituir o `insert` unico por um loop que insere em lotes de 500 registros:

```text
// DE (linha 311):
const { error } = await supabase.from('devedores').insert(records);

// PARA:
const BATCH_SIZE = 500;
let inserted = 0;
let batchError = null;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  const { error } = await supabase.from('devedores').insert(batch);
  if (error) { batchError = error; break; }
  inserted += batch.length;
  setImportProgress(Math.round((inserted / records.length) * 100));
}
```

#### 3. Barra de progresso

Adicionar estado `importProgress` (number, 0-100) e exibir uma barra de progresso (`Progress` component) durante a importacao, mostrando quantos registros ja foram inseridos.

#### 4. Mensagem de sucesso parcial

Se houver erro no meio do processo, informar quantos registros foram inseridos com sucesso antes do erro.

### Secao tecnica

**Novos estados:**
- `importProgress: number` (0-100) - progresso da insercao em lotes

**Mudancas em `handleImport` (linhas 264-321):**
- Loop de insercao em lotes de 500
- Atualizar `importProgress` a cada lote
- Mensagem de erro parcial se falhar no meio

**Mudancas no JSX:**
- Importar `Progress` de `@/components/ui/progress`
- Exibir barra de progresso quando `importing === true`
- Mostrar texto "Inserindo X de Y registros..." abaixo da barra

**Mudancas em `parseCobmais`:**
- Adicionar `console.log` com total de linhas lidas para debug

- Unico arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Sem alteracoes no banco de dados
- Sem novas dependencias (Progress component ja existe)

